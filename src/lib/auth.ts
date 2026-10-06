import { avatarSrc } from "./avatar";
import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { connectDB } from "./db";
import { SITE } from "./site";
import { initialRole, isRole, type Role } from "./roles";
import Member from "@/models/Member";
import Author from "@/models/Author";

/**
 * Connexion au blog : uniquement « Se connecter avec Workyt ».
 *
 * workyt.fr est le fournisseur d'identité (OAuth 2.0 + OpenID Connect, flux
 * « authorization code » + PKCE, lot 0 côté workyt-next). Le blog ne voit
 * jamais le mot de passe. À la première connexion, un Member est créé ; son
 * rôle sur le blog est géré ensuite dans l'onglet Équipe.
 */

export interface WorkytProfile {
    sub: string;
    username?: string;
    preferred_username?: string;
    email?: string;
    picture?: string;
    role?: string;
}

/** Connexion de test : développement local uniquement, jamais en production */
const devLoginEnabled = process.env.BLOG_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

async function upsertMember(p: { workytId: string; username: string; email?: string; avatarUrl?: string; workytRole?: string; forceRole?: Role }) {
    await connectDB();
    const existing = await Member.findOne({ workytId: p.workytId });
    if (existing) {
        existing.username = p.username;
        if (p.email) existing.email = p.email;
        if (p.avatarUrl) existing.avatarUrl = p.avatarUrl;
        existing.workytRole = p.workytRole;
        // Un Admin de workyt.fr reste Admin du blog ; un ancien Admin redescend
        if (p.workytRole === "Admin") existing.role = "admin";
        else if (existing.role === "admin" && !p.forceRole) existing.role = "lecteur";
        if (p.forceRole) existing.role = p.forceRole;
        existing.lastLoginAt = new Date();
        await existing.save();
        // Le profil d'auteur suit le compte workyt.fr (pseudo, photo)
        if (existing.author) await Author.updateOne({ _id: existing.author }, { $set: { avatarUrl: existing.avatarUrl, workytId: existing.workytId } });
        return existing;
    }
    const member = await Member.create({
        workytId: p.workytId,
        username: p.username,
        email: p.email,
        avatarUrl: p.avatarUrl,
        workytRole: p.workytRole,
        role: p.forceRole ?? initialRole(p.workytRole),
        lastLoginAt: new Date(),
    });
    // Ancien auteur du WordPress (même e-mail) : son profil importé et son rôle le suivent
    if (p.email) {
        const author = await Author.findOneAndUpdate(
            { email: p.email.toLowerCase(), member: null },
            { $set: { member: member._id, workytId: member.workytId, ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}) } },
            { new: true }
        );
        if (author) {
            member.author = author._id;
            if (member.role === "lecteur" && isRole(author.wpRole)) member.role = author.wpRole;
            await member.save();
        }
    }
    return member;
}

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: "/connexion/" },
    providers: [
        {
            id: "workyt",
            name: "Workyt",
            type: "oauth",
            wellKnown: `${SITE.workytUrl}/.well-known/openid-configuration`,
            clientId: process.env.WORKYT_CLIENT_ID,
            clientSecret: process.env.WORKYT_CLIENT_SECRET,
            authorization: { params: { scope: "openid profile email role" } },
            idToken: true,
            checks: ["pkce", "state"],
            profile(profile: WorkytProfile) {
                return {
                    id: profile.sub,
                    name: profile.username || profile.preferred_username || "Membre Workyt",
                    email: profile.email,
                    image: profile.picture,
                    workytRole: profile.role,
                };
            },
        },
        ...(devLoginEnabled
            ? [
                  CredentialsProvider({
                      id: "dev",
                      name: "Connexion de développement",
                      credentials: { username: { label: "Pseudo", type: "text" }, role: { label: "Rôle", type: "text" } },
                      async authorize(credentials) {
                          const username = (credentials?.username || "").trim();
                          if (!username) return null;
                          const role = isRole(credentials?.role) ? credentials.role : "lecteur";
                          return { id: `dev-${username.toLowerCase()}`, name: username, devRole: role };
                      },
                  }),
              ]
            : []),
    ],
    callbacks: {
        async jwt({ token, user, account }) {
            // Première connexion : on crée (ou met à jour) le Member
            if (user && account) {
                const u = user as typeof user & { workytRole?: string; devRole?: Role };
                const member = await upsertMember({
                    workytId: account.provider === "dev" ? u.id : String(account.providerAccountId || u.id),
                    username: u.name || "Membre Workyt",
                    email: u.email || undefined,
                    avatarUrl: u.image || undefined,
                    workytRole: u.workytRole,
                    forceRole: account.provider === "dev" ? u.devRole : undefined,
                });
                token.memberId = String(member._id);
                token.role = member.role as Role;
                token.avatar = avatarSrc({ avatarUrl: member.avatarUrl, workytId: member.workytId, seed: member.username });
                token.roleCheckedAt = Date.now();
            } else if (token.memberId && Date.now() - Number(token.roleCheckedAt || 0) > 5 * 60_000) {
                // Rôle relu toutes les 5 min : un retrait de rôle s'applique vite
                await connectDB();
                const m = await Member.findById(token.memberId).select("role avatarUrl workytId username").lean();
                token.role = (m?.role as Role) || "lecteur";
                // Avatar relu aussi : une nouvelle photo de profil s'affiche vite partout
                if (m) token.avatar = avatarSrc({ avatarUrl: m.avatarUrl, workytId: m.workytId, seed: m.username });
                token.roleCheckedAt = Date.now();
            }
            return token;
        },
        async session({ session, token }) {
            const s = session as BlogSession;
            // Même avatar que sur workyt.fr, les commentaires et le dashboard : photo, sinon Blobatar
            s.user = { ...s.user, memberId: String(token.memberId || ""), role: (token.role as Role) || "lecteur", image: (token.avatar as string | undefined) || s.user?.image || null };
            return s;
        },
    },
};

export type BlogSession = Session & { user: Session["user"] & { memberId: string; role: Role } };

export async function getBlogSession(): Promise<BlogSession | null> {
    return (await getServerSession(authOptions)) as BlogSession | null;
}

export function isDevLoginEnabled() {
    return devLoginEnabled;
}
