// Configuration ESLint « flat » (ESLint 9+), comme workyt-next.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
    { ignores: [".next/**", "node_modules/**", "out/**", "public/**", "maquettes/**", "docs/**", "next-env.d.ts"] },
    ...nextCoreWebVitals,
    ...nextTypescript,
];

export default config;
