// Элементы DOM
const dropZone = document.getElementById('dropZone');
const dropZoneContent = document.getElementById('dropZoneContent');
const previewContainer = document.getElementById('previewContainer');
const imagesGrid = document.getElementById('imagesGrid');
const datasetInfo = document.getElementById('datasetInfo');
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const removeBtn = document.getElementById('removeBtn');
const modelButtons = document.getElementById('modelButtons');
const loadingSection = document.getElementById('loadingSection');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const statusBadge = document.getElementById('statusBadge');
const comparisonSummary = document.getElementById('comparisonSummary');
const modelsGrid = document.getElementById('modelsGrid');
const checkModelBtn = document.getElementById('checkModelBtn');
const activeModelPopup = document.getElementById('activeModelPopup');
const popupClose = document.getElementById('popupClose');
const activeModelInfo = document.getElementById('activeModelInfo');

// Новые элементы
const modelsSelection = document.getElementById('modelsSelection');
const modelsList = document.getElementById('modelsList');
const selectedModelsInfo = document.getElementById('selectedModelsInfo');
const startProcessingBtn = document.getElementById('startProcessingBtn');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');

// Элементы режима работы
const modeSection = document.getElementById('modeSelection');
const descriptionModeBtn = document.getElementById('descriptionModeBtn');
const classificationModeBtn = document.getElementById('classificationModeBtn');
const classificationSetup = document.getElementById('classificationSetup');
const positiveClassInput = document.getElementById('positiveClass');
const negativeClassInput = document.getElementById('negativeClass');
const groundTruthSetup = document.getElementById('groundTruthSetup');
const groundTruthImages = document.getElementById('groundTruthImages');

let selectedFiles = [];
let selectedModels = []; // Выбранные модели для обработки
let availableModels = []; // Все доступные VLM модели
let imagePreviews = {}; // Хранение base64 данных изображений для миниатюр
let groundTruth = {}; // Хранение правильных классов для изображений в режиме классификации
const MAX_FILES = 35;

// Переменные режима работы
let currentMode = 'description'; // 'description' или 'classification'
let classificationSettings = {
    positiveClass: 'Самолет',
    negativeClass: 'Не самолет'
};

// Загрузка списка VLM-моделей при старте
window.addEventListener('load', () => {
    // Задержка, чтобы приложение успело загрузиться
    setTimeout(() => {
        loadVLMModels();
        checkModels();
        // Инициализируем режим работы
        setMode(currentMode);
    }, 3000); // Увеличиваем задержку до 3 секунд
});

// Обработчики центральных кнопок управления моделями
if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', () => {
        showNotification('Обновление списка моделей...');
        loadVLMModels();
    });
}

// Обработчики режима работы
if (descriptionModeBtn) {
    descriptionModeBtn.addEventListener('click', () => setMode('description'));
}

if (classificationModeBtn) {
    classificationModeBtn.addEventListener('click', () => setMode('classification'));
}

// Обработчики настроек классификации
if (positiveClassInput) {
    positiveClassInput.addEventListener('input', (e) => {
        classificationSettings.positiveClass = e.target.value.trim();
        if (currentMode === 'classification') {
            updateGroundTruthInterface(); // Обновляем интерфейс с новыми названиями классов
        }
    });
}

if (negativeClassInput) {
    negativeClassInput.addEventListener('input', (e) => {
        classificationSettings.negativeClass = e.target.value.trim();
        if (currentMode === 'classification') {
            updateGroundTruthInterface(); // Обновляем интерфейс с новыми названиями классов
        }
    });
}

// Проверка активной модели
if (checkModelBtn) {
    checkModelBtn.addEventListener('click', showActiveModel);
}

if (popupClose) {
    popupClose.addEventListener('click', () => {
        activeModelPopup.style.display = 'none';
    });
}

// Закрытие popup по клику вне его
if (activeModelPopup) {
    activeModelPopup.addEventListener('click', (e) => {
        if (e.target === activeModelPopup) {
            activeModelPopup.style.display = 'none';
        }
    });
}

async function loadVLMModels() {
    return new Promise((resolve, reject) => {
        console.log('Начинаем загрузку VLM-моделей с XMLHttpRequest...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/vlm-models', true);
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.onload = function() {
            console.log('📡 XMLHttpRequest onload, status:', xhr.status);
            console.log('📡 Response text:', xhr.responseText);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    console.log('📦 Распарсенные данные:', data);
                    
                    if (data.status === 'ok') {
                        availableModels = data.models;
                        displayModelsSelection(data.models);
                        updateStatus('ready', `Найдено ${data.total} VLM-моделей`);
                        console.log('✅ Модели успешно загружены:', data.models);
                        resolve(data);
                    } else {
                        console.error('❌ Ошибка в данных API:', data);
                        updateStatus('error', 'Ошибка загрузки моделей');
                        modelsList.innerHTML = `
                            <div class="error-box">
                                <p>Не удалось загрузить список моделей</p>
                                <p class="error-text">${data.message}</p>
                            </div>
                        `;
                        reject(new Error(data.message || 'API error'));
                    }
                } catch (e) {
                    console.error('❌ Ошибка парсинга JSON:', e);
                    updateStatus('error', 'Ошибка парсинга ответа API');
                    modelsList.innerHTML = `
                        <div class="error-box">
                            <p>Ошибка парсинга ответа от API</p>
                            <p class="error-text">${e.message}</p>
                        </div>
                    `;
                    reject(e);
                }
            } else {
                console.error('❌ HTTP ошибка:', xhr.status, xhr.statusText);
                updateStatus('error', 'Ollama API недоступен');
                modelsList.innerHTML = `
                    <div class="error-box">
                        <p>❌ Не удалось подключиться к Ollama API</p>
                        <p class="hint-text">HTTP ${xhr.status}: ${xhr.statusText}</p>
                    </div>
                `;
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = function() {
            console.error('❌ XMLHttpRequest ошибка сети');
            updateStatus('error', 'Ошибка сети');
            modelsList.innerHTML = `
                <div class="error-box">
                    <p>❌ Ошибка сети при подключении к API</p>
                    <p class="hint-text">Проверьте подключение к интернету</p>
                </div>
            `;
            reject(new Error('Network error'));
        };
        
        xhr.send();
    });
}

function displayModelsSelection(models) {
    if (!models || models.length === 0) {
        modelsList.innerHTML = `
            <div class="no-models">
                <p>📭 VLM-модели не найдены</p>
                <p class="hint-text">Модели с поддержкой vision автоматически загружаются из Ollama API</p>
            </div>
        `;
        return;
    }
    
    modelsList.innerHTML = '';
    
    models.forEach(model => {
        const modelCard = document.createElement('div');
        modelCard.className = 'model-card-select';
        modelCard.dataset.modelId = model.id;
        
        const statusClass = model.loaded ? 'loaded' : 'not-loaded';
        const statusText = model.loaded ? 'Загружена' : 'Не загружена';
        
        modelCard.innerHTML = `
            <div class="model-card-header">
                <input type="checkbox" class="model-checkbox" id="model-${model.id.replace(/[^a-zA-Z0-9]/g, '_')}" data-model-id="${model.id}">
                <label for="model-${model.id.replace(/[^a-zA-Z0-9]/g, '_')}" class="model-card-label">
                    <div class="model-info">
                        <div class="model-name">${model.name}</div>
                        <div class="model-details">
                            <span class="model-publisher">${model.publisher}</span>
                            <span class="model-arch">${model.arch}</span>
                            <span class="model-quant">${model.quantization}</span>
                        </div>
                    </div>
                    <div class="model-status-badge ${statusClass}">${statusText}</div>
                </label>
            </div>
        `;
        
        modelsList.appendChild(modelCard);
    });
    
    // Обработчики чекбоксов
    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleModelSelection);
    });
    
    updateControlButtons();
}

function handleModelSelection(e) {
    const modelId = e.target.dataset.modelId;
    const isChecked = e.target.checked;
    
    if (isChecked) {
        selectedModels.push(modelId);
    } else {
        selectedModels = selectedModels.filter(id => id !== modelId);
    }
    
    updateSelectedModelsInfo();
    updateStartButton();
    updateControlButtons();
}

function updateSelectedModelsInfo() {
    if (selectedModels.length === 0) {
        selectedModelsInfo.innerHTML = '<p>Выберите модели для обработки датасета</p>';
    } else {
        const modelNames = selectedModels.map(id => {
            const model = availableModels.find(m => m.id === id);
            return model ? model.name : id;
        });
        selectedModelsInfo.innerHTML = `
            <p>Выбрано моделей: <strong>${selectedModels.length}</strong></p>
            <p class="selected-list">${modelNames.join(' + ')}</p>
        `;
    }
}

function updateStartButton() {
    const hasFiles = selectedFiles.length > 0;
    const hasModels = selectedModels.length > 0;
    const hasGroundTruth = currentMode !== 'classification' || Object.keys(groundTruth).length === selectedFiles.length;
    startProcessingBtn.disabled = !(hasFiles && hasModels && hasGroundTruth);
}

function updateGroundTruthInterface() {
    console.log('updateGroundTruthInterface called, mode:', currentMode, 'files:', selectedFiles.length);
    
    if (currentMode !== 'classification' || !selectedFiles.length) {
        console.log('Hiding ground truth interface');
        groundTruthImages.innerHTML = '';
        return;
    }
    
    console.log('Showing ground truth interface for', selectedFiles.length, 'files');
    groundTruthImages.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'ground-truth-image-item';
        imageItem.style.cssText = 'background: white; border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); border: 2px solid transparent; transition: all 0.2s ease;';
        
        imageItem.addEventListener('mouseenter', () => {
            imageItem.style.borderColor = '#667eea';
            imageItem.style.transform = 'translateY(-2px)';
            imageItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        imageItem.addEventListener('mouseleave', () => {
            imageItem.style.borderColor = 'transparent';
            imageItem.style.transform = 'translateY(0)';
            imageItem.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
        
        const imagePreview = imagePreviews[file.name] || '';
        const currentGroundTruth = groundTruth[file.name] || '';
        
        console.log('Creating item for file:', file.name, 'preview exists:', !!imagePreview);
        
        imageItem.innerHTML = `
            <img src="${imagePreview}" alt="${file.name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 10px; border: 1px solid #ddd;">
            <div style="font-size: 12px; color: #666; margin-bottom: 10px; text-align: center; font-weight: 500;">${index + 1}. ${file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name}</div>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 13px; color: #28a745; font-weight: 500; padding: 4px 8px; border-radius: 4px; transition: all 0.2s ease;">
                    <input type="radio" name="ground-truth-${index}" value="positive" ${currentGroundTruth === 'positive' ? 'checked' : ''} style="margin: 0; width: 16px; height: 16px; accent-color: #667eea;">
                    ${classificationSettings.positiveClass}
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 13px; color: #dc3545; font-weight: 500; padding: 4px 8px; border-radius: 4px; transition: all 0.2s ease;">
                    <input type="radio" name="ground-truth-${index}" value="negative" ${currentGroundTruth === 'negative' ? 'checked' : ''} style="margin: 0; width: 16px; height: 16px; accent-color: #667eea;">
                    ${classificationSettings.negativeClass}
                </label>
            </div>
        `;
        
        // Обработчики изменения ground truth
        const radios = imageItem.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                groundTruth[file.name] = e.target.value;
                console.log('Ground truth updated for', file.name, ':', e.target.value);
                updateStartButton(); // Обновляем кнопку запуска, так как теперь ground truth может быть заполнен
            });
            
            // Добавляем hover эффекты
            const label = radio.parentElement;
            label.addEventListener('mouseenter', () => {
                label.style.background = 'rgba(0, 0, 0, 0.05)';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
        
        groundTruthImages.appendChild(imageItem);
    });
}

function updateControlButtons() {
    // Кнопки управления моделями удалены, функция оставлена для совместимости
}

// Функция переключения режима работы
function setMode(mode) {
    currentMode = mode;
    
    // Обновляем активные кнопки
    descriptionModeBtn.classList.toggle('active', mode === 'description');
    classificationModeBtn.classList.toggle('active', mode === 'classification');
    
    // Показываем/скрываем настройки классификации
    classificationSetup.style.display = mode === 'classification' ? 'block' : 'none';
    
    // Показываем/скрываем ground truth setup и обновляем его
    if (mode === 'classification') {
        groundTruthSetup.style.display = 'block';
        updateGroundTruthInterface();
    } else {
        groundTruthSetup.style.display = 'none';
    }
    
    // Обновляем плейсхолдеры в настройках
    if (mode === 'classification') {
        positiveClassInput.value = classificationSettings.positiveClass;
        negativeClassInput.value = classificationSettings.negativeClass;
    }
    
    showNotification(`Режим переключен на: ${mode === 'description' ? 'Описание объектов' : 'Бинарная классификация'}`, 'info');
}

function updateModelStatus(modelId, loaded) {
    const model = availableModels.find(m => m.id === modelId);
    if (model) {
        model.loaded = loaded;
    }
    
    const card = document.querySelector(`.model-card-select[data-model-id="${modelId}"]`);
    if (card) {
        const statusBadge = card.querySelector('.model-status-badge');
        
        if (loaded) {
            statusBadge.className = 'model-status-badge loaded';
            statusBadge.textContent = 'Загружена';
        } else {
            statusBadge.className = 'model-status-badge not-loaded';
            statusBadge.textContent = '○ Не загружена';
        }
    }
}

function showNotification(message, type = 'info') {
    // Создаём контейнер для уведомлений, если его нет
    let container = document.querySelector('.notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notifications-container';
        document.body.appendChild(container);
    }
    
    // Создаём уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

async function showActiveModel() {
    try {
        const response = await fetch('/api/active-model');
        const data = await response.json();
        
        if (data.success) {
            const activeModel = data.active_model_short || 'Не загружена';
            
            activeModelInfo.innerHTML = `
                <div class="active-model-display">
                    <div class="current-model">
                        <strong>Сейчас активна:</strong>
                        <div class="model-name-big">${activeModel}</div>
                    </div>
                    
                    <div class="available-models">
                        <strong>Доступные VLM-модели:</strong>
                        <ul>
                            ${data.available_models.map(m => {
                                const short = m.split('/').pop();
                                const isCurrent = data.active_model && m === data.active_model;
                                return `<li class="${isCurrent ? 'current' : ''}">${short} ${isCurrent ? '(активная)' : ''}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                </div>
            `;
            
            activeModelPopup.style.display = 'flex';
        }
    } catch (error) {
        console.error('Ошибка получения активной модели:', error);
    }
}

async function checkModels() {
    // Просто обновляем список моделей
    await loadVLMModels();
}

function updateStatus(status, text) {
    const statusDot = statusBadge.querySelector('.status-dot');
    const statusText = statusBadge.querySelector('.status-text');
    
    statusBadge.className = 'status-badge status-' + status;
    statusText.textContent = text;
}

// Обработка drag & drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        handleFiles(files);
    }
});

uploadButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        handleFiles(files);
    }
});

removeBtn.addEventListener('click', () => {
    selectedFiles = [];
    imagePreviews = {};
    groundTruth = {}; // Очищаем ground truth
    previewContainer.style.display = 'none';
    dropZoneContent.style.display = 'flex';
    modelButtons.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    fileInput.value = '';
    imagesGrid.innerHTML = '';
    datasetInfo.innerHTML = '';
    updateStartButton();
});

// Обработка запуска обработки
startProcessingBtn.addEventListener('click', processDatasetWithModels);

function handleFiles(files) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
    const imageFiles = files.filter(file => validTypes.includes(file.type));
    
    if (imageFiles.length === 0) {
        showError('Не найдено подходящих изображений. Используйте PNG, JPG, JPEG, GIF, BMP или WEBP.');
        return;
    }
    
    if (imageFiles.length > MAX_FILES) {
        showError(`Превышен лимит изображений. Максимум: ${MAX_FILES}, загружено: ${imageFiles.length}`);
        return;
    }
    
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) {
        showError('Общий размер файлов превышает 100 МБ.');
        return;
    }
    
    selectedFiles = imageFiles;
    
    // Сохраняем base64 данные для миниатюр
    imagePreviews = {};
    let loadedCount = 0;
    
    imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreviews[file.name] = e.target.result;
            loadedCount++;
            
            // Когда все изображения загружены, отображаем превью
            if (loadedCount === imageFiles.length) {
                displayImagePreviews(imageFiles);
                // Обновляем ground truth интерфейс, если в режиме классификации
                if (currentMode === 'classification') {
                    updateGroundTruthInterface();
                }
            }
        };
        reader.readAsDataURL(file);
    });
    
    dropZoneContent.style.display = 'none';
    previewContainer.style.display = 'flex';
    modelButtons.style.display = 'block';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    
    updateStartButton();
}

function displayImagePreviews(files) {
    imagesGrid.innerHTML = '';
    
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-image-wrapper';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-image';
            img.alt = file.name;
            
            const imgLabel = document.createElement('div');
            imgLabel.className = 'preview-image-label';
            imgLabel.textContent = `${index + 1}. ${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}`;
            
            imgWrapper.appendChild(img);
            imgWrapper.appendChild(imgLabel);
            imagesGrid.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
    });
    
    const totalSize = (files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2);
    datasetInfo.innerHTML = `
        <div class="dataset-stats">
            <div class="stat-item">
                <span class="stat-icon">📸</span>
                <span class="stat-value">${files.length}</span>
                <span class="stat-label">изображений</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">💾</span>
                <span class="stat-value">${totalSize} МБ</span>
                <span class="stat-label">общий размер</span>
            </div>
        </div>
    `;
}

async function processDatasetWithModels() {
    if (!selectedFiles || selectedFiles.length === 0) {
        showError('Загрузите изображения для обработки');
        return;
    }
    
    if (!selectedModels || selectedModels.length === 0) {
        showError('Выберите хотя бы одну модель');
        return;
    }
    
    startProcessingBtn.disabled = true;
    loadingSection.style.display = 'flex';
    errorSection.style.display = 'none';
    
    // Перестроим обход: для каждой модели — обрабатываем все изображения.
    const allResults = selectedFiles.map((file, idx) => ({
        image_index: idx,
        filename: file.name,
        models_results: []
    }));

    for (let modelIndex = 0; modelIndex < selectedModels.length; modelIndex++) {
        const modelId = selectedModels[modelIndex];
        const modelInfo = availableModels.find(m => m.id === modelId);
        const modelShort = modelId.split('/').pop();

        showNotification(`🔁 Обработка моделью ${modelShort} (${modelIndex + 1}/${selectedModels.length})`, 'info');

        // Загрузка модели (в Ollama API модели всегда доступны)
        try {
            const loadResponse = await fetch('/api/load-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId })
            });

            const loadData = await loadResponse.json();

            if (!loadData.success) {
                showNotification(`❌ Ошибка доступа к ${modelShort}: ${loadData.error}`, 'error');
                // Пропускаем все изображения для этой модели
                allResults.forEach(imgRes => imgRes.models_results.push({
                    model: modelId,
                    model_short: modelShort,
                    success: false,
                    error: loadData.error
                }));
                continue;
            }

            updateModelStatus(modelId, true);
            showNotification(`✅ ${modelShort} готова`, 'success');

        } catch (error) {
            showNotification(`❌ Ошибка проверки ${modelShort}: ${error.message}`, 'error');
            allResults.forEach(imgRes => imgRes.models_results.push({
                model: modelId,
                model_short: modelShort,
                success: false,
                error: error.message
            }));
            continue;
        }

        // Обработка всех изображений этой моделью
        for (let imgIndex = 0; imgIndex < selectedFiles.length; imgIndex++) {
            const currentFile = selectedFiles[imgIndex];
            loadingText.textContent = `🖼️ ${modelShort} обрабатывает ${imgIndex + 1}/${selectedFiles.length}`;
            loadingSubtext.textContent = `${currentFile.name}`;

            try {
                const formData = new FormData();
                formData.append('image', currentFile);
                formData.append('model', modelId);
                formData.append('mode', currentMode);
                
                // Добавляем настройки классификации, если режим classification
                if (currentMode === 'classification') {
                    formData.append('positiveClass', classificationSettings.positiveClass);
                    formData.append('negativeClass', classificationSettings.negativeClass);
                    formData.append('groundTruth', groundTruth[currentFile.name] || '');
                }

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success && data.results && data.results.length > 0) {
                    const result = data.results[0];
                    allResults[imgIndex].models_results.push({
                        model: modelId,
                        model_short: modelShort,
                        success: true,
                        entity: result.entity,
                        processing_time: result.processing_time,
                        tokens_per_second: result.tokens_per_second,
                        total_tokens: result.total_tokens,
                        prompt_tokens: result.prompt_tokens,
                        completion_tokens: result.completion_tokens,
                        temperature: result.temperature,
                        max_tokens: result.max_tokens,
                        model_info: result.model_info,
                        request_info: result.request_info,
                        classification_correct: result.classification_correct
                    });
                    showNotification(`✅ ${modelShort}: "${result.entity}"`, 'success');
                } else {
                    allResults[imgIndex].models_results.push({
                        model: modelId,
                        model_short: modelShort,
                        success: false,
                        error: data.error || 'Ошибка анализа'
                    });
                    showNotification(`❌ ${modelShort}: ${data.error || 'Ошибка анализа'}`, 'error');
                }

            } catch (error) {
                allResults[imgIndex].models_results.push({
                    model: modelId,
                    model_short: modelShort,
                    success: false,
                    error: error.message
                });
                showNotification(`❌ Ошибка обработки ${modelShort}: ${error.message}`, 'error');
            }

            // Короткая пауза между изображениями
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // После обработки всех изображений этой моделью — уведомляем о завершении (выгрузка не требуется)
        showNotification(`✅ ${modelShort} завершила обработку всех изображений`, 'success');
    }
    
    loadingSection.style.display = 'none';
    startProcessingBtn.disabled = false;
    
    if (allResults.length > 0) {
        displayImageComparisonResults(allResults);
        
        // Получаем детальные метрики сравнения моделей
        try {
            const comparisonResponse = await fetch('/api/model-comparison', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    results: allResults.flatMap(img => 
                        img.models_results.map(modelResult => ({
                            filename: img.filename,
                            model: modelResult.model,
                            entity: modelResult.entity,
                            success: modelResult.success,
                            processing_time: modelResult.processing_time,
                            tokens_per_second: modelResult.tokens_per_second,
                            total_tokens: modelResult.total_tokens
                        }))
                    ),
                    mode: currentMode,
                    classificationSettings: classificationSettings,
                    groundTruth: groundTruth
                })
            });
            
            if (comparisonResponse.ok) {
                const comparisonData = await comparisonResponse.json();
                displayModelComparisonMetrics(comparisonData);
            }
        } catch (error) {
            console.error('Ошибка получения метрик сравнения:', error);
        }
        
        showNotification(`Обработка завершена! Проанализировано ${allResults.length} изображений`, 'success');
    } else {
        showError('Не удалось обработать ни одно изображение');
    }
}

function displayModelComparisonMetrics(comparisonData) {
    const comparisonSummary = document.getElementById('comparisonSummary');
    const isClassificationMode = comparisonData.mode === 'classification';

    // Очищаем предыдущее содержимое и сразу формируем весь HTML
    comparisonSummary.innerHTML = `
        <div class="summary-stats">
            Обработано ${allResults.length} изображений ${isClassificationMode ? '(Классификация)' : '(Описание)'}
        </div>
        
        ${isClassificationMode ? `
        <div class="classification-info">
            <h4>Настройки классификации</h4>
            <p><strong>Положительный класс:</strong> ${comparisonData.classification_settings.positive_class}</p>
            <p><strong>Отрицательный класс:</strong> ${comparisonData.classification_settings.negative_class}</p>
        </div>
        ` : ''}
        
        <div class="performance-summary">
            <h3>📈 Сводка производительности</h3>
            <div class="performance-stats">
                <div class="performance-stat">
                    <span class="stat-icon">🖼️</span>
                    <div class="stat-content">
                        <div class="stat-value">${comparisonData.total_images}</div>
                        <div class="stat-label">Изображений обработано</div>
                    </div>
                </div>
                <div class="performance-stat">
                    <span class="stat-icon">Модель</span>
                    <div class="stat-content">
                        <div class="stat-value">${comparisonData.models_compared}</div>
                        <div class="stat-label">Моделей сравнено</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="agreement-matrix-section">
            <h3 class="agreement-matrix-title">📈 Матрица согласия моделей</h3>
            <div class="agreement-matrix-container">
                <div class="agreement-matrix">
                    <div class="matrix-header">Модель</div>
                    ${comparisonData.model_names.map(name => `<div class="matrix-header">${name.split('/').pop()}</div>`).join('')}
                    ${comparisonData.agreement_matrix.map((row, i) => `
                        <div class="matrix-cell matrix-model-name">${comparisonData.model_names[i].split('/').pop()}</div>
                        ${row.map((value, j) => `
                            <div class="matrix-cell ${i === j ? 'matrix-agreement' : 'matrix-percentage'}">
                                ${i === j ? '100%' : `${value}%`}
                            </div>
                        `).join('')}
                    `).join('')}
                </div>
                <div class="matrix-legend">
                    <div class="legend-item">
                        <div class="legend-color legend-high"></div>
                        <span>Высокое согласие (70-100%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color legend-medium"></div>
                        <span>Среднее согласие (40-69%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color legend-low"></div>
                        <span>Низкое согласие (0-39%)</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="detailed-metrics-section">
            <h3 class="detailed-metrics-title">📋 Детальные метрики моделей</h3>
            <div class="metrics-comparison-grid">
                ${Object.entries(comparisonData.performance_metrics).map(([modelName, metrics]) => {
                    const shortName = modelName.split('/').pop();
                    const isQwen = modelName.toLowerCase().includes('qwen');
                    const isGemma = modelName.toLowerCase().includes('gemma');

                    return `
                        <div class="metric-comparison-card ${isQwen ? 'qwen' : isGemma ? 'gemma' : ''}">
                            <div class="metric-card-header">
                                <span class="metric-model-icon">${isQwen ? 'Qwen' : isGemma ? 'Gemma' : 'Другая'}</span>
                                <div>
                                    <div class="metric-model-name">${shortName}</div>
                                    <div class="metric-model-badge">${modelName.split('/')[0]}</div>
                                </div>
                            </div>
                            <div class="detailed-metrics-grid">
                                <div class="detailed-metric" data-tooltip="${isClassificationMode ? 'Количество правильных предсказаний из общего числа' : 'Количество успешных предсказаний из общего числа'}">
                                    <div class="detailed-metric-label">${isClassificationMode ? 'Точность' : 'Успешность'}</div>
                                    <div class="detailed-metric-value">${isClassificationMode ? metrics.correct_predictions : metrics.successful_predictions}/${metrics.total_predictions}</div>
                                    <div class="detailed-metric-unit">(${isClassificationMode ? metrics.accuracy : metrics.success_rate}%)</div>
                                </div>
                                <div class="detailed-metric" data-tooltip="Среднее время обработки одного изображения">
                                    <div class="detailed-metric-label">Время обработки</div>
                                    <div class="detailed-metric-value">${metrics.avg_processing_time}</div>
                                    <div class="detailed-metric-unit">секунд</div>
                                </div>
                                <div class="detailed-metric" data-tooltip="Скорость генерации токенов">
                                    <div class="detailed-metric-label">Токены/сек</div>
                                    <div class="detailed-metric-value">${metrics.avg_tokens_per_second}</div>
                                    <div class="detailed-metric-unit">т/с</div>
                                </div>
                                <div class="detailed-metric" data-tooltip="Общее количество использованных токенов">
                                    <div class="detailed-metric-label">Всего токенов</div>
                                    <div class="detailed-metric-value">${metrics.total_tokens_used}</div>
                                    <div class="detailed-metric-unit">токенов</div>
                                </div>
                                <div class="detailed-metric" data-tooltip="Среднее количество токенов на изображение">
                                    <div class="detailed-metric-label">Токенов/изображение</div>
                                    <div class="detailed-metric-value">${metrics.avg_tokens_used}</div>
                                    <div class="detailed-metric-unit">токенов</div>
                                </div>
                                <div class="detailed-metric" data-tooltip="${isClassificationMode ? 'Процент правильных предсказаний' : 'Процент успешных предсказаний'}">
                                    <div class="detailed-metric-label">${isClassificationMode ? 'Accuracy' : 'Точность'}</div>
                                    <div class="detailed-metric-value">${isClassificationMode ? metrics.accuracy : metrics.success_rate}</div>
                                    <div class="detailed-metric-unit">%</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="enhanced-model-results">
            <h3>Расширенные результаты обработки</h3>
            <div class="enhanced-models-grid">
                ${Object.entries(comparisonData.performance_metrics).map(([modelName, metrics]) => {
                    const shortName = modelName.split('/').pop();
                    const isQwen = modelName.toLowerCase().includes('qwen');
                    const isGemma = modelName.toLowerCase().includes('gemma');

                    return `
                        <div class="enhanced-model-card success">
                            <div class="enhanced-model-header">
                                <div class="enhanced-model-name">${shortName}</div>
                                <div class="enhanced-model-status success">Активна</div>
                            </div>
                            <div class="enhanced-model-entity">Обработано ${metrics.total_predictions} изображений</div>
                            <div class="enhanced-model-metrics">
                                <div class="enhanced-mini-metric">
                                    <div class="enhanced-mini-metric-label">${isClassificationMode ? 'Точность' : 'Успешность'}</div>
                                    <div class="enhanced-mini-metric-value">${isClassificationMode ? metrics.accuracy : metrics.success_rate}%</div>
                                </div>
                                <div class="enhanced-mini-metric">
                                    <div class="enhanced-mini-metric-label">Время</div>
                                    <div class="enhanced-mini-metric-value">${metrics.avg_processing_time}с</div>
                                </div>
                                <div class="enhanced-mini-metric">
                                    <div class="enhanced-mini-metric-label">Токены</div>
                                    <div class="enhanced-mini-metric-value">${metrics.avg_tokens_used}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}function displayImageComparisonResults(allResults) {
    // Очищаем предыдущие результаты
    modelsGrid.innerHTML = '';
    
    // Показываем секцию результатов
    resultsSection.style.display = 'block';
    
    // Обрабатываем результаты для каждого изображения
    allResults.forEach((imageResult, imageIndex) => {
        displayImageResults(imageResult, imageIndex);
    });
}

function displayImageResults(imageResult, imageIndex) {
    const section = document.createElement('div');
    section.className = 'image-results-section';
    
    // Получаем миниатюру изображения
    const imageThumbnail = imagePreviews[imageResult.filename] || '';
    
    section.innerHTML = `
        <div class="image-results-header">
            ${imageThumbnail ? `
                <div class="image-thumbnail-container">
                    <img src="${imageThumbnail}" alt="${imageResult.filename}" class="image-thumbnail">
                </div>
            ` : ''}
            <div class="image-info">
                <h4 class="image-title">🖼️ Изображение ${imageIndex + 1}: ${imageResult.filename}</h4>
                <div class="image-stats">
                    <span class="stat-badge">Моделей: ${imageResult.models_results.length}</span>
                    <span class="stat-badge">✅ ${imageResult.models_results.filter(r => r.success).length} успешных</span>
                </div>
            </div>
        </div>
        <div class="image-models-grid"></div>
    `;
    
    const grid = section.querySelector('.image-models-grid');
    
    imageResult.models_results.forEach((modelResult, modelIndex) => {
        // Проверяем ошибку классификации: если режим классификации И classification_correct НЕ равно true
        const isError = currentMode === 'classification' && modelResult.classification_correct !== true;
        const resultCard = document.createElement('div');
        resultCard.className = `model-result-card ${modelResult.success ? 'success' : 'failed'} ${isError ? 'error' : ''}`;
        
        if (modelResult.success) {
            // Определяем статус для отображения
            let statusText = 'Правильно';
            let statusClass = 'success';
            
            if (currentMode === 'classification') {
                if (modelResult.classification_correct === true) {
                    statusText = 'Правильно';
                    statusClass = 'success';
                } else if (modelResult.classification_correct === false) {
                    statusText = 'Неправильно';
                    statusClass = 'error';
                } else {
                    statusText = 'Не определено';
                    statusClass = 'warning';
                }
            }
            
            resultCard.innerHTML = `
                <div class="model-header">
                    <span class="model-name">${modelResult.model_short}</span>
                    <span class="model-status ${statusClass}">${statusText}</span>
                </div>
                <div class="model-entity ${isError ? 'error' : ''}">${modelResult.entity}</div>
                <div class="model-metrics">
                    <div class="mini-metric">
                        <span class="mini-metric-label">⏱️</span>
                        <span class="mini-metric-value">${modelResult.processing_time}с</span>
                    </div>
                    ${modelResult.tokens_per_second ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">⚡</span>
                        <span class="mini-metric-value">${modelResult.tokens_per_second.toFixed(1)} т/с</span>
                    </div>
                    ` : ''}
                    ${modelResult.total_tokens ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">Время</span>
                        <span class="mini-metric-value">${modelResult.total_tokens} токенов</span>
                    </div>
                    ` : ''}
                    ${modelResult.prompt_tokens ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">📥</span>
                        <span class="mini-metric-value">${modelResult.prompt_tokens} вход</span>
                    </div>
                    ` : ''}
                    ${modelResult.completion_tokens ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">📤</span>
                        <span class="mini-metric-value">${modelResult.completion_tokens} выход</span>
                    </div>
                    ` : ''}
                    ${modelResult.temperature ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">🌡️</span>
                        <span class="mini-metric-value">${modelResult.temperature}</span>
                    </div>
                    ` : ''}
                </div>
                ${modelResult.model_info ? `
                <div class="model-info-section">
                    <div class="info-item">
                        <span class="info-label">Провайдер:</span>
                        <span class="info-value">${modelResult.model_info.provider}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Тип:</span>
                        <span class="info-value">${modelResult.model_info.request_type}</span>
                    </div>
                </div>
                ` : ''}
            `;
        } else {
            resultCard.innerHTML = `
                <div class="model-header">
                    <span class="model-name">${modelResult.model_short}</span>
                    <span class="model-status failed">Ошибка</span>
                </div>
                <div class="model-error">${modelResult.error}</div>
            `;
        }
        
        grid.appendChild(resultCard);
    });
    
    modelsGrid.appendChild(section);
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'flex';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
}
