const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fileContainer = document.getElementById('file-upload-container');
const fileInput = document.getElementById('foto-upload');

const perguntas = [
    "Olá! Vamos registrar a ronda. Qual o nome da Unidade? (Ex: TAG Itapemirim, TAG TIMS, TAG Viana)",
    "Qual a data e o turno? (Ex: 14 de abril de 2026 - 06:00 às 18:00)",
    "Descreva a 1ª Ronda (setores, cadeados, ar-condicionado):",
    "Qual o horário de Chegada da 1ª Ronda? A saída será calculada automaticamente (+30 min). (Ex: 09:00)",
    "Descreva a 2ª Ronda (ou digite 'Nenhuma'):",
    "Qual o horário de Chegada da 2ª Ronda? (Ex: 13:00 ou digite 0 se não houver):",
    "Houve paralisações? (Descreva o motivo e duração ou digite 'Nenhuma'):",
    "Por favor, anexe as fotos da ronda no clipe ao lado (até 4 fotos). Quando terminar, digite 'GERAR' para baixar a planilha."
];

let passoAtual = 0;
let dadosRelatorio = {
    unidade: "", dataTurno: "", ronda1Desc: "", ronda1Horarios: "", 
    ronda2Desc: "", ronda2Horarios: "", paralisacoes: "", fotos: []
};

// Funções de UI do Chat
function addBotMessage(text) {
    const msgDiv = document.createElement('div');
    // Adicionamos classes de animação inicial (opacidade 0 e deslocamento) e espaçamento
    msgDiv.className = "flex justify-start mb-4 opacity-0 translate-y-4 transition-all duration-300 ease-out";
    msgDiv.innerHTML = `
        <div class="flex items-end gap-2 max-w-[90%]">
            <div class="w-8 h-8 flex-shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-lg shadow-sm border border-blue-100">🤖</div>
            <div class="bg-white text-gray-800 p-3.5 rounded-2xl rounded-bl-none shadow-md border border-gray-100 leading-relaxed text-sm md:text-base">${text}</div>
        </div>
    `;
    chatContainer.appendChild(msgDiv);
    
    // Aciona a animação de "surgimento" logo após o elemento entrar na tela
    setTimeout(() => {
        msgDiv.classList.remove('opacity-0', 'translate-y-4');
    }, 10);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = "flex justify-end mb-4 opacity-0 translate-y-4 transition-all duration-300 ease-out";
    msgDiv.innerHTML = `
        <div class="flex items-end gap-2 max-w-[90%] flex-row-reverse">
            <div class="w-8 h-8 flex-shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-sm shadow-sm text-white">👤</div>
            <div class="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-3.5 rounded-2xl rounded-br-none shadow-md leading-relaxed text-sm md:text-base">${text}</div>
        </div>
    `;
    chatContainer.appendChild(msgDiv);

    setTimeout(() => {
        msgDiv.classList.remove('opacity-0', 'translate-y-4');
    }, 10);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Processa a resposta baseada no passo atual
function processarResposta(resposta) {
    if (!resposta.trim() && passoAtual < perguntas.length - 1) return;

    if (passoAtual < perguntas.length) {
        addUserMessage(resposta);
    }

    switch (passoAtual) {
        case 0: dadosRelatorio.unidade = resposta; break;
        case 1: dadosRelatorio.dataTurno = resposta; break;
        case 2: dadosRelatorio.ronda1Desc = resposta; break;
        case 3: dadosRelatorio.ronda1Horarios = resposta; break;
        case 4: dadosRelatorio.ronda2Desc = resposta; break;
        case 5: dadosRelatorio.ronda2Horarios = resposta; break;
        case 6: 
            dadosRelatorio.paralisacoes = resposta; 
            fileContainer.classList.remove('hidden'); // Mostra botão de anexo
            break;
        case 7:
            if (resposta.toUpperCase() === 'GERAR') {
                gerarExcel();
                return;
            }
            break;
    }

    passoAtual++;
    if (passoAtual < perguntas.length) {
        setTimeout(() => addBotMessage(perguntas[passoAtual]), 400);
    }
}

// Lida com o input de fotos e converte para Base64
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, 4); // Limita a 4
    if (files.length > 0) {
        addUserMessage(`📸 ${files.length} foto(s) anexada(s).`);
        dadosRelatorio.fotos = [];
        
        for (let file of files) {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            dadosRelatorio.fotos.push(base64);
        }
    }
});

// Envia dados para o backend Node.js
async function gerarExcel() {
    addBotMessage("⏳ Processando dados e gerando planilha oficial...");
    userInput.disabled = true;
    sendBtn.disabled = true;

    try {
        const response = await fetch('/api/gerar-relatorio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosRelatorio)
        });

        if (!response.ok) throw new Error("Falha na geração");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_${dadosRelatorio.unidade}_Ronda.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        addBotMessage("✅ Relatório gerado com sucesso! Verifique seus downloads.");
    } catch (error) {
        addBotMessage("❌ Ocorreu um erro ao gerar a planilha. Tente novamente.");
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

// Eventos de clique e tecla Enter
sendBtn.addEventListener('click', () => {
    processarResposta(userInput.value);
    userInput.value = '';
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        processarResposta(userInput.value);
        userInput.value = '';
    }
});

// Inicia o chat
setTimeout(() => addBotMessage(perguntas[0]), 500);
