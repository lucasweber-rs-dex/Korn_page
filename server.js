"use strict";

const path = require("path");

// O .env vive em api/, independente de onde o processo foi iniciado.
require("dotenv").config({ path: path.join(__dirname, "api", ".env") });

const express = require("express");

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;
// Em produção o Nginx entrega os arquivos estáticos; aqui isso é desligado com SERVE_STATIC=0.
// No Vercel a pasta public/ é servida automaticamente.
const SERVE_STATIC = process.env.SERVE_STATIC !== "0";
const PUBLIC_DIR = path.join(__dirname, "public");

if (!process.env.ASAAS_API_KEY) {
  console.warn("Aviso: ASAAS_API_KEY não configurado em api/.env. O site sobe, mas a geração de Pix responde 503.");
}

if (SERVE_STATIC) {
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  });

  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
  app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html")));
}

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`tudo.conecta.ai rodando em http://localhost:${PORT}`);
    if (SERVE_STATIC) console.log(`Servindo os arquivos de ${PUBLIC_DIR}`);
  });
}

module.exports = app;
