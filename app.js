"use strict";

const express = require("express");

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";

const PLANOS = {
  mensal: { titulo: "Plano Mensal", valor: 24.9 },
  anual: { titulo: "Plano Anual", valor: 169.9 },
};

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isEmail(value) {
  const v = String(value || "").trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);
}

function isPhone(value) {
  const d = digits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

function isCpf(value) {
  const d = digits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  for (let round = 0; round < 2; round++) {
    const length = 9 + round;
    const weight = length + 1;
    let sum = 0;

    for (let i = 0; i < length; i++) {
      sum += Number(d[i]) * (weight - i);
    }

    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== Number(d[length])) return false;
  }

  return true;
}

function hojeFormatado() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

async function asaasFetch(caminho, opcoes) {
  const resp = await fetch(ASAAS_BASE_URL + caminho, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "tudo.conecta.ai/1.0",
      ...(opcoes && opcoes.headers),
    },
  });

  const dados = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const mensagem = (dados.errors && dados.errors[0] && dados.errors[0].description) || "asaas_erro";
    const erro = new Error(mensagem);
    erro.status = resp.status;
    throw erro;
  }

  return dados;
}

async function buscarOuCriarCliente({ nome, email, cpf }) {
  const cpfLimpo = digits(cpf);

  const busca = await asaasFetch(`/customers?cpfCnpj=${cpfLimpo}`, { method: "GET" });
  if (busca.data && busca.data.length > 0) {
    return busca.data[0].id;
  }

  const criado = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: nome && nome.trim() ? nome.trim() : "Cliente tudo.conecta.ai",
      email,
      cpfCnpj: cpfLimpo,
    }),
  });

  return criado.id;
}

function normalizarStatus(statusAsaas) {
  if (statusAsaas === "RECEIVED" || statusAsaas === "CONFIRMED" || statusAsaas === "RECEIVED_IN_CASH") {
    return "approved";
  }
  if (statusAsaas === "OVERDUE" || statusAsaas === "REFUNDED" || statusAsaas === "DELETED") {
    return "cancelled";
  }
  return "pending";
}

const app = express();
app.use(express.json());

app.get("/api/saude", (req, res) => {
  res.json({ ok: true, pix: Boolean(ASAAS_API_KEY) });
});

app.use("/api", (req, res, next) => {
  if (!ASAAS_API_KEY) {
    return res.status(503).json({ erro: "Pagamento indisponível: ASAAS_API_KEY não configurado em api/.env." });
  }
  next();
});

app.post("/api/pagamentos", async (req, res) => {
  const { plano, nome, email, telefone, cpf } = req.body || {};

  const planoInfo = PLANOS[plano];
  if (!planoInfo) {
    return res.status(400).json({ erro: "Plano inválido." });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!isPhone(telefone)) {
    return res.status(400).json({ erro: "Celular inválido." });
  }
  if (!isCpf(cpf)) {
    return res.status(400).json({ erro: "CPF inválido." });
  }

  try {
    const customerId = await buscarOuCriarCliente({ nome, email, cpf });

    const cobranca = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: planoInfo.valor,
        dueDate: hojeFormatado(),
        description: `tudo.conecta.ai - ${planoInfo.titulo}`,
      }),
    });

    const qr = await asaasFetch(`/payments/${cobranca.id}/pixQrCode`, { method: "GET" });

    res.json({
      id: cobranca.id,
      status: normalizarStatus(cobranca.status),
      qr_code: qr.payload || null,
      qr_code_base64: qr.encodedImage || null,
    });
  } catch (erro) {
    console.error("Erro ao criar pagamento Pix (Asaas):", erro.message || erro);
    res.status(502).json({ erro: "Não foi possível gerar o Pix agora. Tente novamente." });
  }
});

app.get("/api/pagamentos/:id", async (req, res) => {
  try {
    const cobranca = await asaasFetch(`/payments/${req.params.id}`, { method: "GET" });
    res.json({ status: normalizarStatus(cobranca.status) });
  } catch (erro) {
    console.error("Erro ao consultar pagamento (Asaas):", erro.message || erro);
    res.status(502).json({ erro: "Não foi possível consultar o pagamento." });
  }
});

module.exports = app;
