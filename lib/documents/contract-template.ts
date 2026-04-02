import {
  CONTRACT_TEMPLATE_KEY,
  CONTRACT_TEMPLATE_VERSION,
  type ContractDocumentFormInput,
  type OrcamentoDocumentSource,
  type PessoaDocumentSource,
} from "@/lib/documents/types";

type ContractDocumentPayload = {
  assinatura: {
    cidade: string;
    dataExtenso: string;
    dataIso: string;
  };
  contratada: {
    cnpj: string;
    endereco: string;
    nome: string;
  };
  contratante: {
    bairro: string;
    cep: string;
    cidade: string;
    documento: string;
    documentoLabel: string;
    estado: string;
    logradouro: string;
    nome: string;
    numero: string;
  };
  emissao: {
    dataHora: string | null;
  };
  orcamento: {
    id: string;
    identificador: string | null;
  };
  passageiros: Array<{
    dataNascimento: string | null;
    documento: string | null;
    nome: string;
  }>;
  reserva: {
    cancelamentosReembolsos: string;
    condicoesTarifarias: string;
    fornecedor: string;
    localizador: string;
    remarcacoes: string;
    servicoContratado: string;
  };
};

const CONTRATADA = {
  nome: "CONFINS DO MUNDO VIAGENS LTDA",
  cnpj: "53.368.373/0001-86",
  endereco:
    "Rua Alfredo Marotzki, 1206, bairro Canudos, CEP: 93540-200, Novo Hamburgo/RS.",
};

export function buildContractDocument(source: OrcamentoDocumentSource, input: ContractDocumentFormInput) {
  const payload = buildPayloadFromOrcamento(source, input);
  const title = `Contrato - ${payload.contratante.nome}`;

  return {
    html: renderContractHtml(payload, title),
    payload,
    title,
    templateKey: CONTRACT_TEMPLATE_KEY,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
  };
}

export function buildManualContractDocument(input: ContractDocumentFormInput, sources?: {
  contratante?: PessoaDocumentSource | null;
  passageiros?: PessoaDocumentSource[];
}) {
  const payload = buildPayloadFromManual(input, sources);
  const title = `Contrato - ${payload.contratante.nome}`;

  return {
    html: renderContractHtml(payload, title),
    payload,
    title,
    templateKey: CONTRACT_TEMPLATE_KEY,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
  };
}

function buildPayloadFromOrcamento(source: OrcamentoDocumentSource, input: ContractDocumentFormInput) {
  const payload = buildPayload(source, input);
  return payload;
}

function buildPayload(
  source: OrcamentoDocumentSource,
  input: ContractDocumentFormInput,
): ContractDocumentPayload {
  const raw = source.raw;
  const passageiroRows = extractPassengers(raw, source);
  const documentNumber =
    source.clienteCpf ??
    source.pessoaCpf ??
    firstNonEmpty(passageiroRows[0]?.documento) ??
    "Não informado";
  const documentoLabel = inferDocumentLabel(documentNumber);
  const localizador =
    firstNonEmpty(input.localizadorReserva) ??
    firstNonEmpty(
      pickNestedString(raw, ["voos", "0", "localizador"]),
      pickNestedString(raw, ["voos", "0", "codigo_localizador"]),
    ) ??
    "Não informado";
  const termos = firstNonEmpty(
    input.remarcacoes,
    pickString(raw, "termos_condicoes"),
    pickString(raw, "forma_pagamento"),
  );
  const cancelamentos = firstNonEmpty(
    input.cancelamentosReembolsos,
    pickString(raw, "termos_condicoes"),
  );
  const condicoesTarifarias = firstNonEmpty(
    input.condicoesTarifarias,
    pickString(raw, "forma_pagamento"),
    "Conforme regras tarifárias informadas no orçamento espelhado.",
  );
  const supplier =
    firstNonEmpty(
      input.fornecedor,
      pickNestedString(raw, ["voos", "0", "companhia"]),
      pickNestedString(raw, ["voos", "0", "cia"]),
      pickNestedString(raw, ["voos", "0", "fornecedor"]),
    ) ?? "Não informado";

  return {
    assinatura: {
      cidade: input.cidadeAssinatura.trim(),
      dataExtenso: formatDateLong(input.dataAssinatura),
      dataIso: input.dataAssinatura.trim(),
    },
    contratada: CONTRATADA,
    contratante: {
      bairro: input.bairro.trim(),
      cep: input.cep.trim(),
      cidade: input.cidade.trim(),
      documento: documentNumber,
      documentoLabel,
      estado: input.estado.trim().toUpperCase(),
      logradouro: input.logradouro.trim(),
      nome: source.clienteNome,
      numero: input.numero.trim(),
    },
    emissao: {
      dataHora: firstNonEmpty(source.createdAt, source.solicitacaoData),
    },
    orcamento: {
      id: source.id,
      identificador: source.identificador,
    },
    passageiros: passageiroRows,
    reserva: {
      cancelamentosReembolsos:
        cancelamentos ?? "Conforme regras do fornecedor informado no orçamento.",
      condicoesTarifarias:
        condicoesTarifarias ?? "Conforme regras do fornecedor informado no orçamento.",
      fornecedor: supplier,
      localizador,
      remarcacoes:
        termos ?? "Conforme regras do fornecedor informado no orçamento.",
      servicoContratado:
        firstNonEmpty(input.servicoContratado) ??
        "Intermediação na compra de passagens aéreas",
    },
  };
}

function buildPayloadFromManual(
  input: ContractDocumentFormInput,
  sources?: {
    contratante?: PessoaDocumentSource | null;
    passageiros?: PessoaDocumentSource[];
  },
): ContractDocumentPayload {
  const contratante = sources?.contratante ?? null;
  const passageiros =
    sources?.passageiros?.map((person) => ({
      dataNascimento: person.nascimento,
      documento: person.cpf ?? person.passaporte,
      nome: person.nome ?? "Passageiro",
    })) ?? [];
  const manualPassageiros =
    input.manualPassageiros?.map((passenger) => ({
      dataNascimento: firstNonEmpty(passenger.dataNascimento) ?? null,
      documento: firstNonEmpty(passenger.documento) ?? null,
      nome: passenger.nome.trim(),
    })) ?? [];
  const allPassengers = [...passageiros, ...manualPassageiros].filter(
    (passenger) => passenger.nome,
  );
  const documentNumber =
    contratante?.cpf ??
    contratante?.passaporte ??
    firstNonEmpty(input.manualContratanteDocumento) ??
    firstNonEmpty(allPassengers[0]?.documento) ??
    "Não informado";
  const documentoLabel =
    firstNonEmpty(input.manualContratanteDocumentoLabel) ??
    inferDocumentLabel(documentNumber);

  return {
    assinatura: {
      cidade: input.cidadeAssinatura.trim(),
      dataExtenso: formatDateLong(input.dataAssinatura),
      dataIso: input.dataAssinatura.trim(),
    },
    contratada: CONTRATADA,
    contratante: {
      bairro: input.bairro.trim(),
      cep: input.cep.trim(),
      cidade: input.cidade.trim(),
      documento: documentNumber,
      documentoLabel,
      estado: input.estado.trim().toUpperCase(),
      logradouro: input.logradouro.trim(),
      nome:
        contratante?.nome ??
        firstNonEmpty(input.manualContratanteNome) ??
        "Contratante",
      numero: input.numero.trim(),
    },
    emissao: {
      dataHora: contratante?.createdAt ?? null,
    },
    orcamento: {
      id: firstNonEmpty(input.orcamentoId) ?? "manual",
      identificador: null,
    },
    passageiros: allPassengers.length
      ? allPassengers
      : [
          {
            dataNascimento: contratante?.nascimento ?? null,
            documento: contratante?.cpf ?? contratante?.passaporte ?? null,
            nome:
              contratante?.nome ??
              firstNonEmpty(input.manualContratanteNome) ??
              "Contratante",
          },
        ],
    reserva: {
      cancelamentosReembolsos:
        firstNonEmpty(input.cancelamentosReembolsos) ??
        "Conforme regras do fornecedor informado no contrato.",
      condicoesTarifarias:
        firstNonEmpty(input.condicoesTarifarias) ??
        "Conforme regras tarifárias informadas ao contratante.",
      fornecedor: firstNonEmpty(input.fornecedor) ?? "Não informado",
      localizador: firstNonEmpty(input.localizadorReserva) ?? "Não informado",
      remarcacoes:
        firstNonEmpty(input.remarcacoes) ??
        "Conforme regras do fornecedor informado no contrato.",
      servicoContratado:
        firstNonEmpty(input.servicoContratado) ??
        "Intermediação na compra de passagens aéreas",
    },
  };
}

function renderContractHtml(payload: ContractDocumentPayload, title: string) {
  const passengersHtml = payload.passageiros
    .map(
      (passenger) => `
        <tr>
          <td>${escapeHtml(passenger.nome)}</td>
          <td>${escapeHtml(passenger.documento ?? "—")}</td>
          <td>${escapeHtml(passenger.dataNascimento ?? "—")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 16mm 20mm 16mm;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #f3f3f3;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 18mm 14mm;
      background: #fff;
    }

    .title {
      text-align: center;
      font-weight: 700;
      font-size: 16pt;
      line-height: 1.35;
      text-transform: uppercase;
      margin: 0 0 18mm;
    }

    p, li, .party-line, .service-box {
      font-size: 10.6pt;
      line-height: 1.65;
      text-align: justify;
      margin: 0 0 4mm;
    }

    .party-line { margin-bottom: 3.5mm; }
    .label, .var, .section-title, th { font-weight: 700; }
    .label, .section-title { text-transform: uppercase; }
    .section-title { font-size: 11pt; margin: 8mm 0 4mm; }
    .subclause { margin-bottom: 2.8mm; }
    hr.separator { border: 0; border-top: 1px solid rgba(0,0,0,0.65); margin: 8mm 0 9mm; }
    ul { margin: 1.5mm 0 4mm 7mm; padding: 0; }
    li { margin-bottom: 2mm; }
    table { width: 100%; border-collapse: collapse; margin: 5mm 0 6mm; table-layout: fixed; }
    th, td {
      border: 1px solid rgba(0,0,0,0.75);
      padding: 3.2mm 3mm;
      vertical-align: top;
      font-size: 10pt;
      line-height: 1.45;
      word-break: break-word;
    }
    .col-name { width: 44%; }
    .col-doc { width: 22%; }
    .col-date { width: 34%; }
    .date-right { margin-top: 14mm; text-align: right; font-size: 10.8pt; line-height: 1.6; }
    .signatures { display: flex; justify-content: space-between; gap: 16mm; margin-top: 30mm; }
    .signature-block { flex: 1; text-align: center; }
    .signature-line { width: 62%; margin: 0 auto 5mm; border-top: 1px solid rgba(0,0,0,0.85); height: 0; }
    .signature-role, .signature-name, .signature-doc { text-align: center; margin: 0; font-size: 10.4pt; line-height: 1.5; }
    .signature-role { text-transform: uppercase; margin-bottom: 1.5mm; }

    .section-title, table, tr, td, th, .service-box, .date-right, .signatures, .signature-block {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      body { background: #fff; }
      html, body { width: 210mm; min-height: 297mm; }
      .page { margin: 0; width: auto; min-height: auto; padding: 16mm 14mm 18mm; overflow: hidden; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <main class="page">
    <h1 class="title">
      INSTRUMENTO PARTICULAR DE<br />
      CONTRATO DE INTERMEDIAÇÃO E CONSULTORIA<br />
      DE SERVIÇOS TURÍSTICOS
    </h1>

    <p class="party-line">
      <span class="label">CONTRATADA:</span> <strong>${escapeHtml(payload.contratada.nome)}</strong>, inscrita no CNPJ sob o nº <strong>${escapeHtml(payload.contratada.cnpj)}</strong>,
      com sede na ${escapeHtml(payload.contratada.endereco)}
    </p>

    <p class="party-line">
      <span class="label">CONTRATANTE:</span>
      <span class="var">${escapeHtml(payload.contratante.nome)}</span>, inscrito(a) no
      <span class="var">${escapeHtml(payload.contratante.documentoLabel)}</span> sob o nº
      <span class="var">${escapeHtml(payload.contratante.documento)}</span>, residente e domiciliado(a) na
      <span class="var">${escapeHtml(payload.contratante.logradouro)}, nº ${escapeHtml(payload.contratante.numero)}</span>, bairro
      <span class="var">${escapeHtml(payload.contratante.bairro)}</span>, CEP:
      <span class="var">${escapeHtml(payload.contratante.cep)}</span>,
      <span class="var">${escapeHtml(payload.contratante.cidade)}</span>/<span class="var">${escapeHtml(payload.contratante.estado)}</span>.
    </p>

    <hr class="separator" />

    <h2 class="section-title">CLÁUSULA PRIMEIRA – DO OBJETO</h2>
    <p class="subclause">
      1.1. O presente contrato tem por objeto a prestação de serviços de intermediação e consultoria turística pela
      CONTRATADA em favor do CONTRATANTE, compreendendo a curadoria de itinerários, pesquisa de tarifas,
      reserva e emissão de bilhetes aéreos, hospedagem e demais serviços turísticos junto a fornecedores primários
      (companhias aéreas, hotéis e operadoras). 1.2. A CONTRATADA atua exclusivamente como agente intermediário,
      não sendo a prestadora direta dos serviços de transporte ou hotelaria, cuja responsabilidade operacional e
      execução pertencem integralmente aos respectivos fornecedores.
    </p>

    <h2 class="section-title">CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DO CONTRATANTE</h2>
    <p class="subclause">
      2.1. Fornecer todas as informações necessárias para a emissão da passagem e agenciamento de viagem,
      incluindo dados pessoais precisos e preferências de viagem. 2.2. Efetuar o pagamento do valor total da
      reserva, o qual já contempla os honorários de consultoria e agenciamento, bem como quaisquer taxas
      administrativas e encargos adicionais previamente informados. 2.3. Informar com antecedência qualquer
      alteração ou cancelamento da passagem emitida ou serviços de agenciamento, sujeitando-se às políticas dos
      fornecedores e da CONTRATADA.
    </p>

    <h2 class="section-title">CLÁUSULA TERCEIRA – DO PAGAMENTO</h2>
    <p class="subclause">
      3.1. O pagamento pelo serviço de emissão de passagens aéreas e agenciamento de viagens é realizado por
      meio de Cartão de Crédito ou PIX. 3.2. A CONTRATADA fornece os dados necessários para a transação via
      cartão ou as instruções para transferência via PIX. 3.3. Eventuais taxas de serviço embutidas, encargos ou
      diferenças tarifárias são informadas ao CONTRATANTE antes da emissão final da passagem.
    </p>

    <h2 class="section-title">CLÁUSULA QUARTA – DA IDENTIFICAÇÃO DOS PASSAGEIROS</h2>
    <p class="subclause">
      4.1. O CONTRATANTE obrigatoriamente fornece os dados de todos os passageiros da reserva, declarando estar em
      conformidade com a LGPD (Lei 13.709/18) ao compartilhar tais informações para fins de execução deste
      contrato:
    </p>

    <table>
      <thead>
        <tr>
          <th class="col-name">Nome Completo (conforme documento)</th>
          <th class="col-doc">CPF/CNPJ ou Passaporte</th>
          <th class="col-date">Data de Nascimento</th>
        </tr>
      </thead>
      <tbody>
        ${passengersHtml}
      </tbody>
    </table>

    <p class="subclause">
      4.2. A conferência dos dados informados é de responsabilidade exclusiva do CONTRATANTE. Custos de
      reemissão por erro de grafia serão repassados integralmente ao cliente.
    </p>

    <h2 class="section-title">CLÁUSULA QUINTA – DO DETALHAMENTO DOS SERVIÇOS E REGRAS TARIFÁRIAS</h2>
    <p class="subclause">
      5.1. O CONTRATANTE declara plena ciência das condições específicas de cada serviço intermediado (tarifas,
      multas e prazos), conforme detalhado no quadro abaixo e/ou no voucher de confirmação:
    </p>

    <p class="service-box">
      Localizador da reserva:<br />
      <span class="var">${escapeHtml(payload.reserva.localizador)}</span><br />
      Serviço contratado: <span class="var">${escapeHtml(payload.reserva.servicoContratado)}</span><br />
      Fornecedor: <span class="var">${escapeHtml(payload.reserva.fornecedor)}</span><br />
      Condições tarifárias: <span class="var">${escapeHtml(payload.reserva.condicoesTarifarias)}</span><br />
      Remarcações: <span class="var">${escapeHtml(payload.reserva.remarcacoes)}</span><br />
      Cancelamentos/Reembolsos: <span class="var">${escapeHtml(payload.reserva.cancelamentosReembolsos)}</span>
    </p>

    <p class="subclause">
      5.2. O CONTRATANTE reconhece que tais penalidades são estabelecidas pelos fornecedores primários, sendo a
      CONTRATADA mera transmissora destas condições.
    </p>

    <h2 class="section-title">CLÁUSULA SEXTA – POLÍTICA DE CANCELAMENTO E DESISTÊNCIA</h2>
    <p class="subclause">
      6.1. <strong>DESISTÊNCIA EM ATÉ 24 HORAS (ANAC, RESOLUÇÃO 400):</strong> O passageiro poderá desistir da passagem aérea sem ônus em sua
      relação tarifária com a companhia aérea em até 24h após a compra, desde a compra tenha sido realizada com
      antecedência igual ou superior a 7 (sete) dias em relação à data de embarque.
    </p>

    <ul>
      <li>
        <em>Parágrafo Único:</em> Em caso de cancelamento após a prestação da consultoria e emissão, permanece devido o valor de
        R$ 500,00 (quinhentos reais) referente ao serviço intelectual de pesquisa e elaboração de itinerário já
        integralmente realizado.
      </li>
    </ul>

    <p class="subclause">
      6.2. <strong>EMISSÕES COM MENOS DE 7 DIAS:</strong> Para viagens próximas (menos de 7 dias da compra), não se aplica o cancelamento sem ônus,
      prevalecendo as regras restritivas dos fornecedores e a retenção da taxa de serviço da agência. 6.3.
      <strong>CANCELAMENTOS APÓS 24 HORAS:</strong> Estão sujeitos a multas contratuais impostas pelos fornecedores primários, além da retenção
      dos honorários da CONTRATADA.
    </p>

    <h2 class="section-title">CLÁUSULA SÉTIMA – DEVER DE INFORMAÇÃO E LIMITAÇÃO DE RESPONSABILIDADE</h2>
    <p class="subclause">
      7.1. <strong>INTERMEDIAÇÃO PURA:</strong> Conforme jurisprudência do STJ (Resp 2.082.256-SP), a CONTRATADA não responde por danos decorrentes de atrasos,
      cancelamentos de voos, <em>overbooking</em>, extravio de bagagem ou falhas operacionais das companhias aéreas.
      7.2. <strong>DOCUMENTAÇÃO:</strong> É dever exclusivo do passageiro portar RG original (em bom estado e &lt; 10 anos), Passaporte válido,
      Vistos e Certificados de Vacinação. A CONTRATADA não se responsabiliza por negativas de embarque ou
      deportações. 7.3. <strong>SUPORTE:</strong> Em caso de falha operacional do fornecedor, a agência prestará auxílio administrativo
      (interlocução e auxílio em protocolos no <em>Consumidor.gov.br</em>), sem que isso configure responsabilidade solidária.
    </p>

    <h2 class="section-title">CLÁUSULA OITAVA – ACEITAÇÃO TÁCITA E FORO</h2>
    <p class="subclause">
      8.1. <strong>ASSINATURA POR PAGAMENTO:</strong> A efetivação do pagamento importa em aceitação integral e irrestrita de todos os termos deste
      contrato, conforme Art. 107 e 113 do Código Civil. 8.2. Fica eleito o Foro de Novo Hamburgo/RS para dirimir
      quaisquer dúvidas oriundas deste instrumento.
    </p>

    <p class="date-right">
      ${escapeHtml(payload.assinatura.cidade)}, <span class="var">${escapeHtml(payload.assinatura.dataExtenso)}</span>.
    </p>

    <section class="signatures">
      <div class="signature-block">
        <div class="signature-line"></div>
        <p class="signature-role">CONTRATANTE</p>
        <p class="signature-name">${escapeHtml(payload.contratante.nome)}</p>
        <p class="signature-doc">${escapeHtml(payload.contratante.documentoLabel)}: ${escapeHtml(payload.contratante.documento)}</p>
      </div>

      <div class="signature-block">
        <div class="signature-line"></div>
        <p class="signature-role">CONTRATADA</p>
        <p class="signature-name">${escapeHtml(payload.contratada.nome)}</p>
        <p class="signature-doc">CNPJ: ${escapeHtml(payload.contratada.cnpj)}</p>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function extractPassengers(
  raw: Record<string, unknown> | null,
  source: OrcamentoDocumentSource,
) {
  const group = Array.isArray(raw?.passageiros) ? raw.passageiros : [];
  const passengers = group
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, unknown>;
      return {
        dataNascimento: firstNonEmpty(
          readValue(row.nascimento),
          readValue(row.data_nascimento),
        ),
        documento: firstNonEmpty(readValue(row.cpf), readValue(row.passaporte)),
        nome: firstNonEmpty(readValue(row.nome), source.clienteNome) ?? source.clienteNome,
      };
    })
    .filter((value): value is { dataNascimento: string | null; documento: string | null; nome: string } =>
      Boolean(value),
    );

  if (passengers.length > 0) {
    return passengers;
  }

  return [
    {
      dataNascimento: null,
      documento: source.clienteCpf ?? source.pessoaCpf ?? null,
      nome: source.clienteNome,
    },
  ];
}

function pickString(
  object: Record<string, unknown> | null,
  key: string,
) {
  if (!object) {
    return null;
  }

  return readValue(object[key]);
}

function pickNestedString(
  object: Record<string, unknown> | null,
  path: string[],
) {
  let current: unknown = object;

  for (const key of path) {
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isFinite(index) ? current[index] : undefined;
      continue;
    }

    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readValue(current);
}

function readValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim()) ?? null;
}

function inferDocumentLabel(documentNumber: string) {
  const digits = documentNumber.replace(/\D/g, "");
  return digits.length === 11 ? "CPF" : "Passaporte";
}

function formatDateLong(input: string) {
  const date = toDate(input);

  if (!date) {
    return input;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function toDate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const isoLike = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00Z`
    : trimmed.replace(" ", "T");
  const date = new Date(isoLike);

  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
