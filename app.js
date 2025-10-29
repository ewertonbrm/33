document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------
    // 1. Variáveis Globais & Seletores
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
    // 2. Service Worker e Status Offline
    // ----------------------------------------------------------------

    // 2.1. Registro do Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker Registrado!', reg))
            .catch(err => console.error('Falha no Registro do Service Worker:', err));
    }

    // 2.2. Atualizar Status de Conexão
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
    // 3. Funções de Manipulação de Tempo e Dados
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
     * Carrega os dados do ônibus a partir do data.json.
     * @returns {Promise<Array>} Lista de rotas de ônibus.
     */
    async function loadData() {
        displayError(''); // Limpa erros anteriores
        try {
            const response = await fetch('/data.json');
            if (!response.ok) {
                throw new Error('Falha ao carregar data.json: Resposta de rede não foi OK.');
            }
            allRoutes = await response.json();
            
            if (allRoutes && allRoutes.length > 0) {
                 populateRouteSelector(allRoutes);
            } else {
                 throw new Error('O arquivo data.json está vazio ou mal formatado.');
            }
            
            return allRoutes;
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            // Mensagem de erro mais clara para o usuário
            displayError('ERRO: Não foi possível carregar os horários. Tente atualizar a página ou verifique o cache.');
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
        // Este é o passo crucial para o seu app funcionar após a seleção.
        SELECTOR.removeEventListener('change', calculateNextBus); // Evita duplicidade
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
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        let nextTime = null;
        let subsequentTime = null;

        for (let i = 0; i < route.times.length; i++) {
            const [hourStr, minuteStr] = route.times[i].split(':');
            const busMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr);

            if (busMinutes > nowMinutes) {
                // Encontrou o próximo horário
                nextTime = route.times[i];
                // Encontra o horário subsequente (se houver)
                if (i + 1 < route.times.length) {
                    subsequentTime = route.times[i + 1];
                }
                break;
            }
        }
        
        // Caso todos os horários tenham passado, pega o primeiro do dia seguinte (loop)
        if (!nextTime && route.times.length > 0) {
            nextTime = route.times[0]; // Primeiro horário do dia seguinte
            subsequentTime = route.times.length > 1 ? route.times[1] : null;
        }
        
        return { nextTime, subsequentTime };
    }

    /**
     * Inicia ou reinicia a contagem regressiva.
     */
    function calculateNextBus() {
        // Limpa qualquer contagem regressiva anterior
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        displayError(''); // Limpa erros anteriores

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
            COUNTDOWN_DISPLAY.textContent = 'Nenhum horário encontrado para hoje.';
            SUBSEQUENT_TIME_DISPLAY.textContent = 'Nenhum';
            return;
        }

        // Exibe o próximo horário e o subsequente
        NEXT_TIME_DISPLAY.textContent = nextTime;
        SUBSEQUENT_TIME_DISPLAY.textContent = subsequentTime ? subsequentTime : 'Fim da Linha';

        // Inicia o contador
        const [nextHour, nextMinute] = nextTime.split(':').map(Number);
        
        function updateCountdown() {
            const now = new Date();
            let nextBus = new Date(now);
            nextBus.setHours(nextHour, nextMinute, 0, 0);

            // Se o horário já passou, move para o dia seguinte (para o caso de loop)
            if (nextBus < now) {
                nextBus.setDate(nextBus.getDate() + 1);
            }

            const diff = nextBus.getTime() - now.getTime();
            
            if (diff <= 0) {
                // O ônibus chegou/partiu, recalcula imediatamente
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
                // Se for no dia seguinte, mostra dias e horas
                countdownText = `${days}d, ${hours}h, ${minutes}m, ${seconds}s`;
            } else if (hours > 0) {
                // Se for neste dia, mostra horas, minutos e segundos
                countdownText = `${hours}h, ${minutes}m e ${seconds}s`;
            } else {
                // Se for na próxima hora, mostra minutos e segundos
                countdownText = `${minutes}m e ${seconds}s`;
            }

            COUNTDOWN_DISPLAY.textContent = countdownText;
        }

        // Executa a atualização imediatamente e depois a cada segundo
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    // ----------------------------------------------------------------
    // 4. Inicialização
    // ----------------------------------------------------------------

    // Carrega os dados e inicia o cálculo
    loadData().then(() => {
        // Tenta selecionar a primeira linha por padrão se os dados carregarem
        if (allRoutes.length > 0) {
            SELECTOR.value = allRoutes[0].id;
            calculateNextBus();
        }
    });

    // Adiciona evento de recálculo ao botão
    REFRESH_BUTTON.addEventListener('click', calculateNextBus);
});
