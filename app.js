document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------
    // 1. DADOS INCORPORADOS (RESOLVE O PROBLEMA DE CARREGAMENTO)
    // ----------------------------------------------------------------
    const STATIC_BUS_ROUTES = [
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
    
    // ----------------------------------------------------------------
    // 2. Variáveis Globais & Seletores
    // ----------------------------------------------------------------
    const SELECTOR = document.getElementById('route-selector');
    const NEXT_TIME_DISPLAY = document.getElementById('next-time-display');
    const COUNTDOWN_DISPLAY = document.getElementById('countdown-display');
    const SUBSEQUENT_TIME_DISPLAY = document.getElementById('subsequent-time-display');
    const ERROR_MESSAGE = document.getElementById('error-message');
    const REFRESH_BUTTON = document.getElementById('refresh-button');
    const STATUS_MESSAGE = document.getElementById('status-message');

    let allRoutes = [];
    let countdownInterval;

    // ----------------------------------------------------------------
    // 3. Service Worker e Status Offline
    // ----------------------------------------------------------------

    // 3.1. Registro do Service Worker para PWA
    if ('serviceWorker' in navigator) {
        // O cache do Service Worker (SW) foi mantido para a estrutura PWA, 
        // mesmo que o data.json não seja mais crítico.
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker Registrado!', reg))
            .catch(err => console.error('Falha no Registro do Service Worker:', err));
    }

    // 3.2. Atualizar Status de Conexão
    function updateConnectionStatus() {
        if (navigator.onLine) {
            STATUS_MESSAGE.textContent = 'Online';
            STATUS_MESSAGE.className = 'online';
        } else {
            STATUS_MESSAGE.textContent = 'Offline';
            STATUS_MESSAGE.className = 'offline';
        }
    }

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();

    // ----------------------------------------------------------------
    // 4. Funções de Manipulação de Tempo e Dados
    // ----------------------------------------------------------------
    
    /**
     * Exibe ou esconde uma mensagem de erro na interface.
     */
    function displayError(message) {
        if (message) {
            ERROR_MESSAGE.textContent = message;
            ERROR_MESSAGE.style.display = 'block'; 
        } else {
            ERROR_MESSAGE.textContent = '';
            ERROR_MESSAGE.style.display = 'none'; 
        }
    }

    /**
     * Carrega os dados do ônibus a partir da constante interna.
     * @returns {Promise<Array>} Lista de rotas de ônibus.
     */
    async function loadData() {
        // Não precisamos mais do fetch. Carregamos diretamente.
        allRoutes = STATIC_BUS_ROUTES;
        
        if (allRoutes && allRoutes.length > 0) {
            populateRouteSelector(allRoutes);
            return allRoutes;
        } else {
            displayError('ERRO: A lista de horários está vazia. Por favor, adicione os horários.');
            return [];
        }
    }

    /**
     * Preenche o seletor de rotas com base nos dados carregados.
     * @param {Array} routes - Lista de objetos de rotas.
     */
    function populateRouteSelector(routes) {
        SELECTOR.innerHTML = ''; // Limpa as opções existentes
        
        // Adiciona a opção padrão
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecione a Linha...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        SELECTOR.appendChild(defaultOption);

        // Adiciona as rotas carregadas
        routes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.id;
            option.textContent = route.route_name;
            SELECTOR.appendChild(option);
        });

        // Configura o evento para recarregar ao mudar a linha
        SELECTOR.removeEventListener('change', calculateNextBus);
        SELECTOR.addEventListener('change', calculateNextBus);
    }

    /**
     * Encontra o próximo horário e o horário subsequente.
     * @param {string} routeId - ID da rota selecionada.
     * @returns {{nextTime: string|null, subsequentTime: string|null}}
     */
    function findNextTimes(routeId) {
        const route = allRoutes.find(r => r.id === routeId);
        if (!route) return { nextTime: null, subsequentTime: null };

        const now = new Date();
        // Converte a hora atual para minutos totais do dia para comparação
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        let nextTime = null;
        let subsequentTime = null;

        for (let i = 0; i < route.times.length; i++) {
            const [hourStr, minuteStr] = route.times[i].split(':');
            const busMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr);

            if (busMinutes > nowMinutes) {
                // 1. Encontrou o próximo horário
                nextTime = route.times[i];
                // 2. Encontra o horário subsequente (se houver)
                if (i + 1 < route.times.length) {
                    subsequentTime = route.times[i + 1];
                }
                break;
            }
        }
        
        // 3. Caso todos os horários tenham passado (fim do dia), o próximo é o primeiro do dia seguinte
        if (!nextTime && route.times.length > 0) {
            nextTime = route.times[0]; 
            subsequentTime = route.times.length > 1 ? route.times[1] : null;
        }
        
        return { nextTime, subsequentTime };
    }

    /**
     * Inicia ou reinicia a contagem regressiva e atualiza a interface.
     */
    function calculateNextBus() {
        // Limpa qualquer contagem regressiva anterior
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        displayError('');

        const selectedRouteId = SELECTOR.value;
        if (!selectedRouteId) {
            NEXT_TIME_DISPLAY.textContent = '--:--';
            COUNTDOWN_DISPLAY.textContent = 'Selecione uma linha.';
            SUBSEQUENT_TIME_DISPLAY.textContent = 'Nenhum';
            return;
        }

        const { nextTime, subsequentTime } = findNextTimes(selectedRouteId);

        if (!nextTime) {
            NEXT_TIME_DISPLAY.textContent = 'Fim';
            COUNTDOWN_DISPLAY.textContent = 'Nenhum horário disponível para hoje.';
            SUBSEQUENT_TIME_DISPLAY.textContent = 'Nenhum';
            return;
        }

        // Exibe os horários
        NEXT_TIME_DISPLAY.textContent = nextTime;
        SUBSEQUENT_TIME_DISPLAY.textContent = subsequentTime ? subsequentTime : 'Fim da Linha (só amanhã)';

        // Configuração do contador
        const [nextHour, nextMinute] = nextTime.split(':').map(Number);
        
        function updateCountdown() {
            const now = new Date();
            let nextBus = new Date(now);
            nextBus.setHours(nextHour, nextMinute, 0, 0);

            // Se o horário for menor que o horário atual, ele é o primeiro do dia seguinte
            if (nextBus < now) {
                nextBus.setDate(nextBus.getDate() + 1);
            }

            const diff = nextBus.getTime() - now.getTime();
            
            if (diff <= 0) {
                // O ônibus chegou/partiu, recalcula para o próximo do dia
                clearInterval(countdownInterval);
                calculateNextBus();
                return;
            }

            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / (3600 * 24));
            const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            let countdownText = '';

            if (days > 0) {
                countdownText = `${days}d, ${hours}h, ${minutes}m, ${seconds}s`;
            } else if (hours > 0) {
                countdownText = `${hours}h, ${minutes}m e ${seconds}s`;
            } else {
                countdownText = `${minutes}m e ${seconds}s`;
            }

            COUNTDOWN_DISPLAY.textContent = countdownText;
        }

        // Executa a atualização imediatamente e depois a cada segundo
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    // ----------------------------------------------------------------
    // 5. Inicialização
    // ----------------------------------------------------------------

    // Carrega os dados e tenta selecionar a primeira linha
    loadData().then(() => {
        if (allRoutes.length > 0) {
            // Seleciona a primeira linha por padrão e inicia o cálculo
            SELECTOR.value = allRoutes[0].id;
            calculateNextBus();
        }
    });

    // Adiciona evento de recálculo ao botão
    REFRESH_BUTTON.addEventListener('click', calculateNextBus);
});
