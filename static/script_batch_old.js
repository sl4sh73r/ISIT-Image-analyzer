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
const analyzeQwenBtn = document.getElementById('analyzeQwenBtn');
const analyzeGemmaBtn = document.getElementById('analyzeGemmaBtn');
const qwenStatus = document.getElementById('qwenStatus');
const gemmaStatus = document.getElementById('gemmaStatus');
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

let selectedFiles = [];
const MAX_FILES = 35;

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

async function showActiveModel() {
    try {
        const response = await fetch('/api/active-model');
        const data = await response.json();
        
        if (data.success) {
            const activeModel = data.active_model_short || 'Не загружена';
            const instructions = data.instructions;
            
            activeModelInfo.innerHTML = `
                <div class="active-model-display">
                    <div class="current-model">
                        <strong>Сейчас активна:</strong>
                        <div class="model-name-big">${activeModel}</div>
                    </div>
                    
                    <div class="available-models">
                        <strong>Доступные для сравнения:</strong>
                        <ul>
                            ${data.available_models.map(m => {
                                const short = m.split('/')[1] || m;
                                const isCurrent = data.active_model && m === data.active_model;
                                return `<li class="${isCurrent ? 'current' : ''}">${short} ${isCurrent ? '✓' : ''}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                    
                    ${data.manual_switching_required ? `
                        <div class="switch-instructions">
                            <strong>🔄 Как переключить:</strong>
                            <ol>
                                <li>${instructions.step1}</li>
                                <li>${instructions.step2}</li>
                                <li>${instructions.step3}</li>
                                <li>${instructions.step4}</li>
                            </ol>
                        </div>
                    ` : ''}
                </div>
            `;
            
            activeModelPopup.style.display = 'flex';
        }
    } catch (error) {
        console.error('Ошибка получения активной модели:', error);
    }
}

// Проверка доступности моделей при загрузке
window.addEventListener('load', checkModels);

async function checkModels() {
    try {
        const response = await fetch('/api/check-models');
        const data = await response.json();
        
        if (data.status === 'ok') {
            const autoSwitching = data.auto_switching;
            
            if (data.all_loaded) {
                updateStatus('ready', `✓ Обе модели готовы (${data.loaded_count}/${data.total_count})`);
            } else if (data.loaded_count > 0) {
                const loaded = data.models.filter(m => m.available).map(m => m.short_name).join(', ');
                if (autoSwitching) {
                    updateStatus('ready', `🔄 Автопереключение (загружена: ${loaded})`);
                } else {
                    updateStatus('warning', `⚠ Загружены: ${loaded} (${data.loaded_count}/${data.total_count})`);
                }
            } else {
                if (autoSwitching) {
                    updateStatus('warning', '🔄 Модели будут загружены автоматически');
                } else {
                    updateStatus('error', '✗ Модели не загружены в LM Studio');
                }
            }
            
            // Обновляем баннер с информацией
            updateInfoBanner(data);
        } else {
            updateStatus('error', 'Ошибка подключения к LM Studio');
        }
    } catch (error) {
        updateStatus('error', 'LM Studio недоступен');
    }
}

function updateInfoBanner(data) {
    const banner = document.getElementById('infoBanner');
    if (!banner) return;
    
    const infoBanner = banner.querySelector('.info-content');
    if (!infoBanner) return;
    
    infoBanner.innerHTML = `
        <strong>🔄 Batch Processing:</strong> 
        Загрузите до ${MAX_FILES} изображений одновременно. Выберите модель для обработки всего датасета.
    `;
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

// Обработка клика на кнопку загрузки
uploadButton.addEventListener('click', () => {
    fileInput.click();
});

// Обработка выбора файла
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        handleFiles(files);
    }
});

// Обработка удаления изображения
removeBtn.addEventListener('click', () => {
    selectedFiles = [];
    previewContainer.style.display = 'none';
    dropZoneContent.style.display = 'flex';
    modelButtons.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    fileInput.value = '';
    imagesGrid.innerHTML = '';
    datasetInfo.innerHTML = '';
    resetModelButtons();
});

// Обработчики кнопок моделей
analyzeQwenBtn.addEventListener('click', () => analyzeBatchWithModel('qwen/qwen3-vl-4b', 'qwen'));
analyzeGemmaBtn.addEventListener('click', () => analyzeBatchWithModel('google/gemma-3-4b', 'gemma'));

function resetModelButtons() {
    qwenStatus.textContent = '';
    qwenStatus.className = 'model-status';
    gemmaStatus.textContent = '';
    gemmaStatus.className = 'model-status';
    analyzeQwenBtn.disabled = false;
    analyzeGemmaBtn.disabled = false;
}

function updateModelStatus(model, status, text) {
    const statusEl = model === 'qwen' ? qwenStatus : gemmaStatus;
    statusEl.className = `model-status ${status}`;
    statusEl.textContent = text;
}

function handleFiles(files) {
    // Фильтруем только изображения
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
    
    // Проверка общего размера
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) { // 100MB
        showError('Общий размер файлов превышает 100 МБ.');
        return;
    }
    
    selectedFiles = imageFiles;
    
    // Отображаем превью
    displayImagePreviews(imageFiles);
    
    // Показываем кнопки выбора моделей
    dropZoneContent.style.display = 'none';
    previewContainer.style.display = 'flex';
    modelButtons.style.display = 'block';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    resetModelButtons();
    
    // Устанавливаем статус "ожидание"
    updateModelStatus('qwen', 'pending', 'Ожидание');
    updateModelStatus('gemma', 'pending', 'Ожидание');
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
    
    // Показываем информацию о датасете
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

async function analyzeBatchWithModel(modelName, modelType) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    // Блокируем кнопку
    const btn = modelType === 'qwen' ? analyzeQwenBtn : analyzeGemmaBtn;
    btn.disabled = true;
    
    // Обновляем статус
    updateModelStatus(modelType, 'processing', `Обработка (0/${selectedFiles.length})...`);
    
    // Показываем загрузку
    loadingSection.style.display = 'flex';
    errorSection.style.display = 'none';
    
    const modelTitle = modelType === 'qwen' ? 'Qwen3-VL-4B' : 'Gemma-3-4B';
    loadingText.textContent = `Анализ датасета с помощью ${modelTitle}...`;
    loadingSubtext.textContent = `Обработка ${selectedFiles.length} изображений. Это может занять несколько минут...`;
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });
    formData.append('model', modelName);
    
    try {
        const response = await fetch('/api/analyze-batch', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        loadingSection.style.display = 'none';
        
        if (data.success) {
            // Обновляем статус
            updateModelStatus(modelType, 'completed', `✓ Готово (${data.stats.successful}/${data.stats.total_images})`);
            
            // Показываем результаты
            displayBatchResults(data, modelType);
        } else {
            updateModelStatus(modelType, 'error', '✗ Ошибка');
            showError(data.error || 'Ошибка при анализе датасета');
            btn.disabled = false;
        }
    } catch (error) {
        loadingSection.style.display = 'none';
        updateModelStatus(modelType, 'error', '✗ Ошибка');
        showError('Ошибка подключения к серверу: ' + error.message);
        btn.disabled = false;
    }
}

function displayBatchResults(data, modelType) {
    const { results, stats } = data;
    
    // Заголовок результатов
    comparisonSummary.innerHTML = `
        <div class="batch-summary">
            <h3>📊 Результаты обработки: ${stats.model_short}</h3>
            <div class="batch-stats-grid">
                <div class="batch-stat success">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.successful}</div>
                        <div class="stat-label">успешно</div>
                    </div>
                </div>
                ${stats.failed > 0 ? `
                <div class="batch-stat error">
                    <div class="stat-icon">❌</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.failed}</div>
                        <div class="stat-label">ошибок</div>
                    </div>
                </div>
                ` : ''}
                ${stats.total_processing_time ? `
                <div class="batch-stat">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.total_processing_time}с</div>
                        <div class="stat-label">общее время</div>
                    </div>
                </div>
                ` : ''}
                ${stats.average_processing_time ? `
                <div class="batch-stat">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.average_processing_time}с</div>
                        <div class="stat-label">среднее время</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Сетка результатов
    modelsGrid.innerHTML = '<div class="batch-results-grid">';
    
    results.forEach(result => {
        const resultCard = document.createElement('div');
        resultCard.className = `batch-result-card ${result.success ? 'success' : 'failed'}`;
        
        if (result.success) {
            resultCard.innerHTML = `
                <div class="result-header">
                    <span class="result-index">#${result.index + 1}</span>
                    <span class="result-status success">✓</span>
                </div>
                <div class="result-filename">${result.filename.length > 30 ? result.filename.substring(0, 27) + '...' : result.filename}</div>
                <div class="result-entity">${result.entity}</div>
                <div class="result-metrics">
                    <div class="mini-metric">
                        <span class="mini-metric-label">⏱️</span>
                        <span class="mini-metric-value">${result.processing_time}с</span>
                    </div>
                    ${result.tokens_per_second ? `
                    <div class="mini-metric">
                        <span class="mini-metric-label">⚡</span>
                        <span class="mini-metric-value">${result.tokens_per_second.toFixed(1)} т/с</span>
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            resultCard.innerHTML = `
                <div class="result-header">
                    <span class="result-index">#${result.index + 1}</span>
                    <span class="result-status failed">✗</span>
                </div>
                <div class="result-filename">${result.filename.length > 30 ? result.filename.substring(0, 27) + '...' : result.filename}</div>
                <div class="result-error">${result.error}</div>
            `;
        }
        
        modelsGrid.querySelector('.batch-results-grid').appendChild(resultCard);
    });
    
    modelsGrid.innerHTML += '</div>';
    resultsSection.style.display = 'block';
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'flex';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
}
