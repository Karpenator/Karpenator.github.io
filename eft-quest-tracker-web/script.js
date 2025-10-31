document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const container = document.getElementById('quests-container'); // Контейнер карточек
    const gameModeSelect = document.getElementById('gameModeSelect');
    const refreshButton = document.getElementById('refreshButton');
    const logFileInput = document.getElementById('logFileInput'); // Input для файла лога

    // Элементы фильтров и сортировки
    const traderFilter = document.getElementById('traderFilter');
    const kappaFilter = document.getElementById('kappaFilter');
    const completedFilter = document.getElementById('completedFilter');
    const sortOrder = document.getElementById('sortOrder');
    const cardSizeSelect = document.getElementById('cardSizeSelect'); // Размер карточки
    const searchInput = document.getElementById('searchInput'); // Поле поиска

    // Ключи для кэша и режима игры
    const MODE_KEY = 'eft-selected-mode';
    const BASE_CACHE_KEY = 'eft-quests-data-';
    const COMPLETED_QUESTS_KEY = 'eft-completed-quests';
    const CARD_SIZE_KEY = 'eft-card-size';

    // Переменные для хранения данных
    let currentTasks = []; // Все задачи для текущего режима
    let filteredTasks = []; // Отфильтрованные и отсортированные задачи
    let completedQuests = JSON.parse(localStorage.getItem(COMPLETED_QUESTS_KEY)) || [];

    // Функция для получения ключа кэша на основе режима
    function getCacheKey(mode) {
        return BASE_CACHE_KEY + mode;
    }

    // Функция для получения данных из кэша
    function getCache(key, duration) {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const parsed = JSON.parse(cached);
        const now = new Date().getTime();

        if (now - parsed.timestamp > duration) {
            localStorage.removeItem(key);
            return null;
        }

        return parsed.data;
    }

    // Функция для сохранения данных в кэш
    function setCache(key, data) {
        const cacheObj = {
            timestamp: new Date().getTime(),
            data
        };
        localStorage.setItem(key, JSON.stringify(cacheObj));
    }

    // Функция для сохранения выполненных заданий
    function saveCompletedQuests() {
        localStorage.setItem(COMPLETED_QUESTS_KEY, JSON.stringify(completedQuests));
    }

    // Функция для загрузки данных (из кэша или API)
    function loadQuests(mode) {
        const CACHE_DURATION = 60 * 60 * 1000;
        const cacheKey = getCacheKey(mode);

        const cachedData = getCache(cacheKey, CACHE_DURATION);

        if (cachedData) {
            console.log(`Загрузка данных из кэша для режима ${mode}.`);
            loadingDiv.style.display = 'none';
            currentTasks = cachedData;
            initializeFilters();
            updateDisplay(); // Используем updateDisplay для инициализации filteredTasks
        } else {
            console.log(`Кэш отсутствует или устарел для режима ${mode}. Запрос к API...`);
            fetchQuestsFromAPI(mode);
        }
    }

    // Функция для выполнения запроса к API
    function fetchQuestsFromAPI(mode) {
        loadingDiv.style.display = 'block';

        // Добавлен minPlayerLevel в запрос
        const query = `
            query GetTasks {
                tasks(gameMode: ${mode}, lang: ru) {
                    id
                    kappaRequired
                    name
                    wikiLink
                    taskImageLink
                    minPlayerLevel
                    trader {
                        name
                        image4xLink
                        imageLink
                    }
                }
            }
        `;

        fetch('https://api.tarkov.dev/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.errors) {
                console.error('Ошибки GraphQL:', data.errors);
                loadingDiv.textContent = 'Ошибка при получении данных: ' + JSON.stringify(data.errors);
                return;
            }
            loadingDiv.style.display = 'none';

            const tasks = data.data.tasks;
            const cacheKey = getCacheKey(mode);
            setCache(cacheKey, tasks);
            console.log(`Данные для режима ${mode} сохранены в кэш.`);
            currentTasks = tasks;
            initializeFilters();
            updateDisplay(); // Используем updateDisplay для инициализации filteredTasks
        })
        .catch(error => {
            console.error('Ошибка сети:', error);
            loadingDiv.textContent = 'Ошибка сети при загрузке данных.';
        });
    }

    // Функция для инициализации фильтров
    function initializeFilters() {
        const traders = [...new Set(currentTasks.map(t => t.trader.name))].sort();
        traderFilter.innerHTML = '<option value="">Все</option>';
        traders.forEach(traderName => {
            const option = document.createElement('option');
            option.value = traderName;
            option.textContent = traderName;
            traderFilter.appendChild(option);
        });
    }

    // Функция для фильтрации, сортировки и поиска заданий
    function filterAndSortTasks(tasks) {
        let filtered = tasks;

        // Поиск
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(task => task.name.toLowerCase().includes(searchTerm));
        }

        // Фильтр по торговцу
        const selectedTrader = traderFilter.value;
        if (selectedTrader) {
            filtered = filtered.filter(task => task.trader.name === selectedTrader);
        }

        // Фильтр по Каппе
        const selectedKappa = kappaFilter.value;
        if (selectedKappa !== '') {
            filtered = filtered.filter(task => task.kappaRequired === (selectedKappa === 'true'));
        }

        // Фильтр по статусу выполнения
        const selectedCompleted = completedFilter.value;
        if (selectedCompleted === 'completed') {
            filtered = filtered.filter(task => completedQuests.includes(task.id));
        } else if (selectedCompleted === 'not_completed') {
            filtered = filtered.filter(task => !completedQuests.includes(task.id));
        }

        // Сортировка
        const order = sortOrder.value;
        filtered.sort((a, b) => {
            switch (order) {
                case 'name_asc':
                    return a.name.localeCompare(b.name, 'ru-RU');
                case 'name_desc':
                    return b.name.localeCompare(a.name, 'ru-RU');
                case 'trader_asc':
                    return a.trader.name.localeCompare(b.trader.name, 'ru-RU');
                case 'trader_desc':
                    return b.trader.name.localeCompare(a.trader.name, 'ru-RU');
                case 'level_asc':
                    return (a.minPlayerLevel || 0) - (b.minPlayerLevel || 0);
                case 'level_desc':
                    return (b.minPlayerLevel || 0) - (a.minPlayerLevel || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // Функция для отображения квестов
    function renderQuests(tasks) {
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<p>Нет заданий, соответствующих фильтрам.</p>';
            return;
        }

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'quest-card';
            card.dataset.questId = task.id;

            if (completedQuests.includes(task.id)) {
                card.classList.add('completed');
            }

            const nameElement = document.createElement('h3');
            nameElement.textContent = task.name;

            // --- Новый элемент: Уровень ---
            const levelElement = document.createElement('div');
            levelElement.className = 'quest-level';
            levelElement.textContent = `Уровень: ${task.minPlayerLevel || '0'}`;
            if (task.minPlayerLevel && task.minPlayerLevel > 0) {
                levelElement.style.color = '#4CAF50';
            } else {
                levelElement.style.color = '#aaa';
            }

            const imageElement = document.createElement('img');
            imageElement.className = 'quest-image';
            imageElement.src = task.taskImageLink || 'assets/placeholder_image_url.jpg'; // Обновите путь, если используете
            imageElement.alt = `Изображение для задания ${task.name}`;
            imageElement.onclick = (e) => {
                e.stopPropagation(); // Останавливаем всплытие, чтобы не срабатывал клик по карточке
                if (task.wikiLink) {
                    window.open(task.wikiLink, '_blank');
                }
            };

            const traderImageElement = document.createElement('img');
            traderImageElement.className = 'trader-image';
            traderImageElement.src = task.trader.image4xLink || task.trader.imageLink || 'assets/placeholder_trader_image_url.jpg'; // Обновите путь, если используете
            traderImageElement.alt = `Изображение торговца ${task.trader.name}`;

            const traderNameElement = document.createElement('div');
            traderNameElement.className = 'trader-name';
            traderNameElement.textContent = task.trader.name;

            const kappaElement = document.createElement('div');
            kappaElement.className = 'kappa-required';
            kappaElement.textContent = task.kappaRequired ? 'Требуется Каппа' : '';

            card.appendChild(nameElement);
            card.appendChild(levelElement);
            card.appendChild(imageElement);
            card.appendChild(traderImageElement);
            card.appendChild(traderNameElement);
            card.appendChild(kappaElement);

            // Обработчик клика по карточке для переключения статуса выполнения
            card.addEventListener('click', () => {
                const questId = card.dataset.questId;
                if (completedQuests.includes(questId)) {
                    // Если выполнено, снимаем галочку
                    completedQuests = completedQuests.filter(id => id !== questId);
                    card.classList.remove('completed');
                    console.log(`Задание ${task.name} отмечено как НЕ выполнено.`);
                } else {
                    // Если не выполнено, ставим галочку
                    completedQuests.push(questId);
                    card.classList.add('completed');
                    console.log(`Задание ${task.name} отмечено как выполнено.`);
                }
                saveCompletedQuests(); // Сохраняем изменения
                // Обновляем отображение, так как фильтр по статусу может изменить видимость
                updateDisplay();
            });

            container.appendChild(card);
        });
    }

    // Функция для обновления отображения карточек (фильтрация, сортировка, поиск)
    function updateDisplay() {
        filteredTasks = filterAndSortTasks(currentTasks);
        renderQuests(filteredTasks);
    }

    // Функция для обновления отображения карточек на основе completedQuests (только для статуса выполнения)
    function updateCompletedCards() {
        const allCards = document.querySelectorAll('.quest-card');
        allCards.forEach(card => {
            const questId = card.dataset.questId;
            if (completedQuests.includes(questId)) {
                card.classList.add('completed');
            } else {
                card.classList.remove('completed');
            }
        });
        // После обновления статуса выполнения, перерисовываем с учётом фильтров
        updateDisplay();
    }

    // --- НОВАЯ ЛОГИКА: Обработка файла лога ---
    logFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log("Файл не выбран.");
            return;
        }

        console.log("Анализ файла:", file.name);

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const foundIds = parseNotificationLogContent(content);

                console.log("Найдены ID выполненных заданий в логе:", foundIds);

                const newCompleted = foundIds.filter(id => !completedQuests.includes(id));
                if (newCompleted.length > 0) {
                    completedQuests = [...new Set([...completedQuests, ...newCompleted])];
                    saveCompletedQuests();
                    console.log("Список выполненных заданий обновлён. Новые:", newCompleted);
                    updateCompletedCards(); // Обновляем отображение
                } else {
                    console.log("Новых выполненных заданий не найдено в логе.");
                }
            } catch (error) {
                console.error("Ошибка при разборе содержимого файла лога:", error);
                alert("Произошла ошибка при чтении файла лога.");
            }
        };

        reader.onerror = function(e) {
            console.error("Ошибка при чтении файла лога:", e);
            alert("Произошла ошибка при чтении файла лога.");
        };

        reader.readAsText(file); // Читаем как текст
    });

    // Функция для анализа содержимого файла лога
    function parseNotificationLogContent(content) {
        const completedIds = [];
        // Регулярное выражение для поиска "templateId": "ID successMessageText"
        const regex = /"templateId":\s*"([a-f0-9]{24})\s+successMessageText"/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            // match[1] содержит ID
            completedIds.push(match[1]);
        }
        return completedIds;
    }

    // --- НОВАЯ ЛОГИКА: Управление размером карточек ---
    function setCardSize(size) {
        // Удаляем старые классы размера
        container.classList.remove('card-size-small', 'card-size-medium', 'card-size-large');
        // Добавляем новый класс размера, если он не 'medium' (стандартный стиль)
        if (size && size !== 'medium') {
            container.classList.add(`card-size-${size}`);
        }
        // Сохраняем выбранный размер в localStorage
        localStorage.setItem(CARD_SIZE_KEY, size);
        console.log(`Размер карточки установлен на: ${size}`);
    }

    // Загружаем сохранённый размер карточки при запуске
    function loadSavedCardSize() {
        const savedSize = localStorage.getItem(CARD_SIZE_KEY);
        if (savedSize && ['small', 'medium', 'large'].includes(savedSize)) {
            cardSizeSelect.value = savedSize;
            setCardSize(savedSize);
        } else {
            // Устанавливаем размер 'medium' по умолчанию
            cardSizeSelect.value = 'small';
            setCardSize('small');
        }
    }

    // --- Остальные обработчики (фильтры, сортировка, режим игры) ---
    // Поиск по вводу (с задержкой для производительности)
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(updateDisplay, 300); // Задержка 300мс
    });

    traderFilter.addEventListener('change', updateDisplay);
    kappaFilter.addEventListener('change', updateDisplay);
    completedFilter.addEventListener('change', updateDisplay);
    sortOrder.addEventListener('change', updateDisplay);

    // Обработчик изменения размера карточки
    cardSizeSelect.addEventListener('change', function() {
        const selectedSize = this.value;
        setCardSize(selectedSize);
    });

    gameModeSelect.addEventListener('change', function() {
        const selectedMode = this.value;
        localStorage.setItem(MODE_KEY, selectedMode);
        loadQuests(selectedMode);
    });

    refreshButton.addEventListener('click', function() {
        const currentMode = gameModeSelect.value;
        const cacheKey = getCacheKey(currentMode);
        localStorage.removeItem(cacheKey);
        console.log(`Кэш для режима ${currentMode} очищен. Запрос новых данных.`);
        loadQuests(currentMode); // Перезагружаем данные для текущего режима
    });

    // Загружаем квесты для начального режима
    loadQuests(gameModeSelect.value);

    // Загружаем сохранённый размер карточки
    loadSavedCardSize();
});