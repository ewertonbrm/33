/* Variáveis globais para os IDs dos elementos */
const SELECTOR = document.getElementById('route-selector');
const NEXT_TIME_DISPLAY = document.getElementById('next-time-display');
const COUNTDOWN_DISPLAY = document.getElementById('countdown-display');
const SUBSEQUENT_TIME_DISPLAY = document.getElementById('subsequent-time-display');
const REFRESH_BUTTON = document.getElementById('refresh-button');
const ERROR_MESSAGE = document.getElementById('error-message');

let currentRouteId = null;
let allRoutesData = [];
let countdownInterval = null;

// ====================================================================
// FUNÇÕES DE UTILIDADE E REGISTRO PWA
// ====================================================================

/**
 * 1. REGISTRO DO SERVICE WORKER (Torna o app instalável)
 * ------------------------------------------------------------------
 * O Service Worker é essencial para o funcionamento offline e instalação.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker Registrado!', reg))
            .catch(err => console.log('Falha no registro do Service Worker:', err));
    }
}


/**
 * Exibe a mensagem de erro no DOM
 * @param {string} message 
 */
function displayError(message) {
    console.error(message);
    ERROR_MESSAGE.textContent = 'ERRO: ' + message;
    ERROR_MESSAGE.style.display = 'block';
    NEXT_TIME_DISPLAY.textContent = '--:--';
    COUNTDOWN_DISPLAY.textContent = 'Erro ao carregar';
    SUBSEQUENT_TIME_DISPLAY.textContent = '--:--';
}

/**
 * Esconde a mensagem de erro
 */
function hideError() {
    ERROR_MESSAGE.style.display = 'none';
    ERROR_MESSAGE.textContent = '';
}

// ====================================================================
// DADOS (Incorporados no JS para garantia de funcionamento offline)
// ====================================================================

/**
 * Retorna os dados de horários.
 * No ambiente real, essa função faria um 'fetch' do data.json.
 * Aqui, os dados estão hardcoded para garantir o funcionamento offline imediato.
 * @returns {Array} Array de rotas.
 */
function loadData() {
    return [
      {
        "id": "planalto-praiadomeio-bomjesus",
        "route_name": "Planalto/Praia do Meio - Bom Jesus",
        "times": [
          "00:13", "02:27", "04:07", "04:27", "04:47", "05:02", "05:17", "05:31", "05:46", "06:01",
          "06:14", "06:28", "06:42", "06:57", "07:12", "07:27", "07:44", "08:02", "08:22", "08:42",
          "09:02", "09:22", "09:37", "09:52", "10:12", "10:32", "10:52", "11:12", "11:32", "11:52",
          "12:09", "12:27", "12:42", "12:57", "13:15", "13:32", "13:47", "14:07", "14:27", "14:47",
          "15:07", "15:22", "15:37", "15:52", "16:07", "16:22", "16:37", "16:52", "17:07", "17:22",
          "17:42", "18:07", "18:32", "18:47", "19:27", "19:57", "20:37", "21:07", "21:42", "22:17"
        ]
      },
      {
        "id": "praiadomeio-planalto-wm",
        "route_name": "Praia do Meio/Planalto - WM",
        "times": [
          "01:35", "03:49", "05:29", "05:49", "06:14", "06:29", "06:49", "07:03", "07:18", "07:33",
          "07:46", "08:00", "08:14", "08:24", "08:39", "08:54", "09:11", "09:29", "09:49", "10:09",
          "10:29", "10:49", "11:04", "11:19", "11:39", "11:59", "12:19", "12:39", "12:59", "13:19",
          "13:36", "13:54", "14:09", "14:24", "14:42", "14:59", "15:19", "15:39", "15:59", "16:19",
          "16:44", "16:59", "17:14", "17:29", "17:44", "17:59", "18:14", "18:29", "18:44", "18:59",
          "19:19", "19:44", "20:09", "20:19", "20:59", "21:24", "22:04", "22:34", "23:04", "23:39"
        ]
      }
    ];
}

// ====================================================================
// LÓGICA DE HORÁRIOS
// ====================================================================

/**
 * Calcula o próximo horário de ônibus.
 * @param {Array<string>} times - Lista de horários no formato "HH:MM".
 * @returns {{nextTime: string | null, subsequentTime: string | null, msUntilNext: number | null}}
 */
function calculateNextBus(times) {
    const now = new Date();
    const currentTimeMs = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
    
    let nextTime = null;
    let subsequentTime = null;
    let nextTimeIndex = -1;

    // 1. Encontrar o próximo horário (que seja maior que a hora atual)
    for (let i = 0; i < times.length; i++) {
        const [hour, minute] = times[i].split(':').map(Number);
        const busTimeMs = hour * 3600000 + minute * 60000;
        
        if (busTimeMs > currentTimeMs) {
            nextTime = times[i];
            nextTimeIndex = i;
            break;
        }
    }

    // 2. Encontrar o horário subsequente
    if (nextTimeIndex !== -1 && nextTimeIndex + 1 < times.length) {
        subsequentTime = times[nextTimeIndex + 1];
    }
    
    // 3. Se não houver mais horários hoje, pega o primeiro de amanhã (opcional, mas bom para 24h)
    let msUntilNext = null;
    if (nextTime) {
        const [hour, minute] = nextTime.split(':').map(Number);
        
        let nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
        
        // Se o próximo horário já passou (o que só aconteceria se houvesse algum erro no loop), 
        // considera que é amanhã.
        if (nextDate.getTime() < now.getTime()) {
            nextDate.setDate(now.getDate() + 1);
        }
        
        msUntilNext = nextDate.getTime() - now.getTime();

    } else {
        // Se não houver mais horários hoje, o próximo é o primeiro de amanhã.
        if (times.length > 0) {
            nextTime = times[0];
            const [hour, minute] = nextTime.split(':').map(Number);
            
            let nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0, 0);
            msUntilNext = nextDate.getTime() - now.getTime();
            
            // O subsequente é o segundo de amanhã (se houver)
            subsequentTime = times[1] || times[0];
        }
    }


    return { nextTime, subsequentTime, msUntilNext };
}

/**
 * Atualiza o display da contagem regressiva a cada segundo.
 * @param {number} ms - Milissegundos restantes.
 */
function updateCountdown(ms) {
    if (ms === null || ms < 0) {
        COUNTDOWN_DISPLAY.textContent = "Dia Encerrado. Veja o próximo horário.";
        clearInterval(countdownInterval);
        return;
    }

    let totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    let parts = [];
    if (hours > 0) {
        parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
    }
    if (seconds > 0 || parts.length === 0) { // Garante que segundos sempre apareça, ou pelo menos um valor
        parts.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`);
    }

    COUNTDOWN_DISPLAY.textContent = parts.join(parts.length > 2 ? ', ' : ' e ');
}

/**
 * Inicia o ciclo de atualização para a rota selecionada.
 * @param {boolean} forceRefresh - Se TRUE, limpa o intervalo existente.
 */
function startUpdateCycle(forceRefresh = false) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const currentRoute = allRoutesData.find(route => route.id === currentRouteId);

    if (!currentRoute) {
        NEXT_TIME_DISPLAY.textContent = '--:--';
        COUNTDOWN_DISPLAY.textContent = 'Selecione uma linha.';
        SUBSEQUENT_TIME_DISPLAY.textContent = '--:--';
        return;
    }
    
    hideError();

    const updateDisplay = () => {
        const { nextTime, subsequentTime, msUntilNext } = calculateNextBus(currentRoute.times);

        NEXT_TIME_DISPLAY.textContent = nextTime || '--:--';
        SUBSEQUENT_TIME_DISPLAY.textContent = subsequentTime || '--:--';

        if (msUntilNext !== null) {
            updateCountdown(msUntilNext);
        } else {
            COUNTDOWN_DISPLAY.textContent = "Não há mais horários disponíveis hoje.";
            clearInterval(countdownInterval);
        }
        
        // Se a contagem regressiva acabar, reinicia o ciclo para buscar o próximo ônibus de verdade.
        if (msUntilNext < 1000) {
             startUpdateCycle(true); 
        }
    };
    
    // Atualiza a cada segundo
    countdownInterval = setInterval(updateDisplay, 1000);
    
    // Roda uma vez imediatamente
    updateDisplay(); 
}

// ====================================================================
// INICIALIZAÇÃO
// ====================================================================

/**
 * Preenche o seletor com as rotas e inicia o ciclo.
 */
function initializeApp() {
    registerServiceWorker(); // REGISTRO DO PWA

    try {
        allRoutesData = loadData();
        
        if (allRoutesData.length === 0) {
            displayError('Nenhuma rota encontrada nos dados.');
            return;
        }

        // 1. Preenche o SELECTOR
        allRoutesData.forEach(route => {
            const option = document.createElement('option');
            option.value = route.id;
            option.textContent = route.route_name;
            SELECTOR.appendChild(option);
        });

        // 2. Define a rota inicial
        currentRouteId = allRoutesData[0].id; // Seleciona a primeira linha por padrão
        SELECTOR.value = currentRouteId;

        // 3. Adiciona listeners de evento
        SELECTOR.addEventListener('change', (event) => {
            currentRouteId = event.target.value;
            startUpdateCycle(true);
        });
        
        REFRESH_BUTTON.addEventListener('click', () => {
             startUpdateCycle(true);
        });

        // 4. Inicia o primeiro ciclo
        startUpdateCycle(true);

    } catch (e) {
        displayError(`Falha ao processar os dados: ${e.message}`);
    }
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeApp);
