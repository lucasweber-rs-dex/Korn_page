(function () {
  "use strict";

  var form = document.querySelector(".field-grid");
  var button = document.querySelector(".pay-button");
  if (!form || !button) return;

  var status = document.getElementById("status-pagamento");
  var paymentBox = document.querySelector(".payment-box");
  var plano = paymentBox ? paymentBox.dataset.plano : null;
  var pixResult = document.getElementById("pix-resultado");
  var pixQr = document.getElementById("pix-qr");
  var pixCodigo = document.getElementById("pix-codigo");
  var pixCopiar = document.getElementById("pix-copiar");
  var nomeInput = document.getElementById("nome");
  var emailInput = document.getElementById("email");
  var telefoneInput = document.getElementById("telefone");
  var cpfInput = document.getElementById("cpf");

  var POLL_INTERVALO_MS = 3000;
  var POLL_MAX_TENTATIVAS = 100; // ~5 minutos
  var pollTimer = null;
  var pollTentativas = 0;

  function digits(value) {
    return value.replace(/\D/g, "");
  }

  function isEmail(value) {
    var v = value.trim();
    if (v.length > 254) return false;
    return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);
  }

  // Celular brasileiro: DDD (2) + 8 ou 9 dígitos.
  function isPhone(value) {
    var d = digits(value);
    if (d.length !== 10 && d.length !== 11) return false;
    if (Number(d.slice(0, 2)) < 11) return false;
    if (d.length === 11 && d[2] !== "9") return false;
    return true;
  }

  // CPF: 11 dígitos validados pelos dois dígitos verificadores.
  function isCpf(value) {
    var d = digits(value);
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;

    for (var round = 0; round < 2; round++) {
      var length = 9 + round;
      var weight = length + 1;
      var sum = 0;

      for (var i = 0; i < length; i++) {
        sum += Number(d[i]) * (weight - i);
      }

      var rest = (sum * 10) % 11;
      if (rest === 10) rest = 0;
      if (rest !== Number(d[length])) return false;
    }

    return true;
  }

  var fields = [
    { input: emailInput, test: isEmail, message: "Informe um e-mail válido, como nome@exemplo.com." },
    { input: telefoneInput, test: isPhone, message: "Informe um celular com DDD, como (11) 90000-0000." },
    { input: cpfInput, test: isCpf, message: "Informe um CPF válido, com 11 dígitos." }
  ].filter(function (field) {
    return field.input;
  });

  fields.forEach(function (field) {
    var error = document.createElement("p");
    error.className = "field-error";
    error.id = field.input.id + "-erro";
    error.hidden = true;
    field.input.insertAdjacentElement("afterend", error);
    field.error = error;
  });

  function isFilled(field) {
    return field.input.value.trim() !== "";
  }

  function showError(field) {
    var invalid = isFilled(field) && !field.test(field.input.value);
    field.error.textContent = invalid ? field.message : "";
    field.error.hidden = !invalid;
    field.input.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (invalid) {
      field.input.setAttribute("aria-describedby", field.error.id);
    } else {
      field.input.removeAttribute("aria-describedby");
    }
  }

  function refresh() {
    var allValid = fields.every(function (field) {
      return field.test(field.input.value);
    });

    button.disabled = !allValid;

    if (status && !button.dataset.clicked) {
      status.textContent = allValid
        ? "Dados validados. Clique em GERAR PIX para continuar."
        : "Preencha e-mail, celular e CPF válidos para liberar a geração do Pix.";
    }

    return allValid;
  }

  fields.forEach(function (field) {
    field.input.addEventListener("input", function () {
      if (!field.error.hidden) showError(field);
      refresh();
    });

    field.input.addEventListener("blur", function () {
      showError(field);
    });
  });

  function pararPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function mostrarErro(mensagem) {
    pararPolling();
    button.disabled = false;
    button.dataset.clicked = "";
    if (status) status.textContent = mensagem;
  }

  function iniciarPolling(id) {
    pollTentativas = 0;
    pollTimer = setInterval(function () {
      pollTentativas++;

      fetch("/api/pagamentos/" + encodeURIComponent(id))
        .then(function (resp) {
          if (!resp.ok) throw new Error("status_falhou");
          return resp.json();
        })
        .then(function (dados) {
          if (dados.status === "approved") {
            pararPolling();
            if (status) status.textContent = "Pagamento aprovado! Seu acesso foi liberado.";
            return;
          }

          if (dados.status === "cancelled" || dados.status === "rejected") {
            mostrarErro("O Pix foi cancelado. Gere um novo código para tentar novamente.");
            if (pixResult) pixResult.hidden = true;
            return;
          }

          if (pollTentativas >= POLL_MAX_TENTATIVAS) {
            mostrarErro("O código Pix expirou. Gere um novo código para tentar novamente.");
            if (pixResult) pixResult.hidden = true;
          }
        })
        .catch(function () {
          if (pollTentativas >= POLL_MAX_TENTATIVAS) {
            mostrarErro("Não foi possível confirmar o pagamento. Tente novamente.");
          }
        });
    }, POLL_INTERVALO_MS);
  }

  button.addEventListener("click", function () {
    if (button.disabled || !plano) return;

    button.disabled = true;
    button.dataset.clicked = "true";
    if (status) status.textContent = "Gerando o código Pix...";
    if (pixResult) pixResult.hidden = true;
    pararPolling();

    fetch("/api/pagamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plano: plano,
        nome: nomeInput ? nomeInput.value.trim() : "",
        email: emailInput.value.trim(),
        telefone: telefoneInput.value.trim(),
        cpf: cpfInput.value.trim(),
      }),
    })
      .then(function (resp) {
        if (!resp.ok) throw new Error("pagamento_falhou");
        return resp.json();
      })
      .then(function (dados) {
        if (!dados.qr_code_base64 || !dados.qr_code) throw new Error("resposta_incompleta");

        if (pixQr) pixQr.src = "data:image/png;base64," + dados.qr_code_base64;
        if (pixCodigo) pixCodigo.textContent = dados.qr_code;
        if (pixResult) pixResult.hidden = false;
        if (status) status.textContent = "Escaneie o QR code ou copie o código para pagar.";

        iniciarPolling(dados.id);
      })
      .catch(function () {
        mostrarErro("Não foi possível gerar o Pix agora. Tente novamente.");
      });
  });

  if (pixCopiar) {
    pixCopiar.addEventListener("click", function () {
      if (!pixCodigo || !pixCodigo.textContent) return;
      navigator.clipboard.writeText(pixCodigo.textContent).then(function () {
        var textoOriginal = pixCopiar.textContent;
        pixCopiar.textContent = "Copiado!";
        setTimeout(function () {
          pixCopiar.textContent = textoOriginal;
        }, 2000);
      });
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  refresh();
})();
