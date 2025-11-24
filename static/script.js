// Элементы DOM
const dropZone = document.getElementById('dropZone');
const dropZoneContent = document.getElementById('dropZoneContent');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
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

let selectedFile = null;
let qwenResult = null;
let gemmaResult = null;

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
    
    if (data.auto_switching) {
        infoBanner.innerHTML = `
            <strong>🔄 Автоматическое переключение моделей:</strong> 
            Приложение автоматически загрузит и переключит модели для сравнения. 
            Просто загрузите изображение!
        `;
    } else {
        infoBanner.innerHTML = `
            <strong>Как использовать:</strong> Загрузите обе модели в LM Studio последовательно. 
            Приложение автоматически протестирует каждую модель и сравнит их производительность.
        `;
    }
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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Обработка клика на кнопку загрузки
uploadButton.addEventListener('click', () => {
    fileInput.click();
});

// Обработка выбора файла
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Обработка удаления изображения
removeBtn.addEventListener('click', () => {
    selectedFile = null;
    qwenResult = null;
    gemmaResult = null;
    previewContainer.style.display = 'none';
    dropZoneContent.style.display = 'flex';
    modelButtons.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    fileInput.value = '';
    resetModelButtons();
});

// Обработчики кнопок моделей
analyzeQwenBtn.addEventListener('click', () => analyzeWithModel('qwen/qwen3-vl-4b', 'qwen'));
analyzeGemmaBtn.addEventListener('click', () => analyzeWithModel('google/gemma-3-4b', 'gemma'));

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

function handleFile(file) {
    // Проверка типа файла
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError('Неподдерживаемый формат файла. Используйте PNG, JPG, JPEG, GIF, BMP или WEBP.');
        return;
    }
    
    // Проверка размера файла (16 МБ)
    if (file.size > 16 * 1024 * 1024) {
        showError('Размер файла превышает 16 МБ.');
        return;
    }
    
    selectedFile = file;
    qwenResult = null;
    gemmaResult = null;
    
    // Показ превью
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropZoneContent.style.display = 'none';
        previewContainer.style.display = 'flex';
        
        // Показываем кнопки выбора моделей
        modelButtons.style.display = 'block';
        resultsSection.style.display = 'none';
        errorSection.style.display = 'none';
        resetModelButtons();
        
        // Устанавливаем статус "ожидание"
        updateModelStatus('qwen', 'pending', 'Ожидание');
        updateModelStatus('gemma', 'pending', 'Ожидание');
    };
    reader.readAsDataURL(file);
}

async function analyzeWithModel(modelName, modelType) {
    if (!selectedFile) return;
    
    // Блокируем кнопку
    const btn = modelType === 'qwen' ? analyzeQwenBtn : analyzeGemmaBtn;
    btn.disabled = true;
    
    // Обновляем статус
    updateModelStatus(modelType, 'processing', 'Обработка...');
    
    // Показываем загрузку
    loadingSection.style.display = 'flex';
    errorSection.style.display = 'none';
    
    const modelTitle = modelType === 'qwen' ? 'Qwen3-VL-4B' : 'Gemma-3-4B';
    loadingText.textContent = `Анализ с помощью ${modelTitle}...`;
    loadingSubtext.textContent = `Убедитесь, что модель ${modelName} загружена в LM Studio`;
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('model', modelName);
    
    try {
        const response = await fetch('/api/analyze-single', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        loadingSection.style.display = 'none';
        
        if (data.success) {
            // Сохраняем результат
            if (modelType === 'qwen') {
                qwenResult = data.result;
            } else {
                gemmaResult = data.result;
            }
            
            // Обновляем статус
            updateModelStatus(modelType, 'completed', '✓ Готово');
            
            // Если есть оба результата - показываем сравнение
            if (qwenResult && gemmaResult) {
                displayComparison();
            } else {
                // Показываем только текущий результат
                displaySingleResult(data.result, modelType);
            }
        } else {
            updateModelStatus(modelType, 'error', '✗ Ошибка');
            showError(data.error || 'Ошибка при анализе изображения');
            btn.disabled = false; // Разблокируем кнопку при ошибке
        }
    } catch (error) {
        loadingSection.style.display = 'none';
        updateModelStatus(modelType, 'error', '✗ Ошибка');
        showError('Ошибка подключения к серверу: ' + error.message);
        btn.disabled = false;
    }
}

function displaySingleResult(result, modelType) {
    const modelName = result.model.split('/')[1] || result.model;
    const modelTitle = modelType === 'qwen' ? 'Qwen3-VL-4B' : 'Gemma-3-4B';
    
    comparisonSummary.innerHTML = `
        <div class="single-result-card">
            <h3>📝 Результат: ${modelTitle}</h3>
            <div class="result-text">${result.result}</div>
            <p class="hint-text">
                💡 Теперь переключите модель в LM Studio и нажмите вторую кнопку для сравнения
            </p>
        </div>
    `;
    
    modelsGrid.innerHTML = createModelCard(result);
    resultsSection.style.display = 'block';
}

function displayComparison() {
    // Создаём массив результатов для displayResults
    const results = [qwenResult, gemmaResult];
    
    // Вычисляем сравнение
    const comparison = calculateComparison(results);
    
    // Отображаем стандартное сравнение
    displayResults(results, comparison);
}

function calculateComparison(results) {
    const comparison = {};
    
    if (results.length < 2) return comparison;
    
    const model1 = results[0];
    const model2 = results[1];
    
    // Сравнение времени
    if (model1.processing_time && model2.processing_time) {
        const timeDiff = Math.abs(model1.processing_time - model2.processing_time);
        comparison.time_difference = timeDiff;
        comparison.faster_model = model1.processing_time < model2.processing_time ? model1.model : model2.model;
        
        const avgTime = (model1.processing_time + model2.processing_time) / 2;
        if (avgTime > 0) {
            comparison.time_difference_percent = (timeDiff / avgTime * 100).toFixed(1);
        }
    }
    
    // Сравнение скорости токенов
    if (model1.tokens_per_second && model2.tokens_per_second) {
        const speedDiff = Math.abs(model1.tokens_per_second - model2.tokens_per_second);
        comparison.speed_difference = speedDiff;
        comparison.faster_tokens_model = model1.tokens_per_second > model2.tokens_per_second ? model1.model : model2.model;
        
        const avgSpeed = (model1.tokens_per_second + model2.tokens_per_second) / 2;
        if (avgSpeed > 0) {
            comparison.speed_difference_percent = (speedDiff / avgSpeed * 100).toFixed(1);
        }
    }
    
    return comparison;
}

function displayResults(results, comparison) {
    // Отображаем сравнительную сводку
    displayComparisonSummary(comparison, results);
    
    // Отображаем детальные метрики для каждой модели
    displayModelMetrics(results);
    
    resultsSection.style.display = 'block';
}

function displayComparisonSummary(comparison, results) {
    // Проверяем количество успешных результатов
    const successfulResults = results.filter(r => !r.error);
    
    if (successfulResults.length < 2) {
        const failedModels = results.filter(r => r.error).map(r => r.model.split('/')[1] || r.model);
        comparisonSummary.innerHTML = `
            <div class="no-comparison">
                <p><strong>⚠️ Частичное сравнение</strong></p>
                <p>Недоступна модель: ${failedModels.join(', ')}</p>
                <p style="margin-top: 1rem; font-size: 0.875rem;">
                    Загрузите обе модели в LM Studio для полного сравнения
                </p>
            </div>
        `;
        return;
    }
    
    if (!comparison || Object.keys(comparison).length === 0) {
        comparisonSummary.innerHTML = '<p class="no-comparison">Недостаточно данных для сравнения</p>';
        return;
    }
    
    let html = '<div class="summary-cards">';
    
    // Сравнение скорости
    if (comparison.faster_model) {
        const fasterModelName = comparison.faster_model.split('/')[1] || comparison.faster_model;
        html += `
            <div class="summary-card winner">
                <div class="card-icon">⚡</div>
                <div class="card-content">
                    <h3>Быстрее</h3>
                    <p class="model-name">${fasterModelName}</p>
                    <p class="detail">на ${comparison.time_difference}с (${comparison.time_difference_percent}%)</p>
                </div>
            </div>
        `;
    }
    
    // Сравнение эффективности токенов
    if (comparison.faster_tokens_model) {
        const fasterTokensModel = comparison.faster_tokens_model.split('/')[1] || comparison.faster_tokens_model;
        html += `
            <div class="summary-card">
                <div class="card-icon">🚀</div>
                <div class="card-content">
                    <h3>Выше скорость генерации</h3>
                    <p class="model-name">${fasterTokensModel}</p>
                    <p class="detail">на ${comparison.tokens_per_second_diff} токенов/сек</p>
                </div>
            </div>
        `;
    }
    
    // Сравнение использования токенов
    if (comparison.more_efficient_model) {
        const efficientModel = comparison.more_efficient_model.split('/')[1] || comparison.more_efficient_model;
        html += `
            <div class="summary-card">
                <div class="card-icon">💡</div>
                <div class="card-content">
                    <h3>Эффективнее по токенам</h3>
                    <p class="model-name">${efficientModel}</p>
                    <p class="detail">экономия ${comparison.total_tokens_diff} токенов</p>
                </div>
            </div>
        `;
    }
    
    // Совпадение ответов
    if (comparison.answers_match !== undefined) {
        const icon = comparison.answers_match ? '✅' : '⚠️';
        const status = comparison.answers_match ? 'Идентичные' : 'Разные';
        const statusClass = comparison.answers_match ? 'match' : 'mismatch';
        html += `
            <div class="summary-card ${statusClass}">
                <div class="card-icon">${icon}</div>
                <div class="card-content">
                    <h3>Ответы</h3>
                    <p class="model-name">${status}</p>
                    <p class="detail">${results[0].entity} vs ${results[1].entity}</p>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    comparisonSummary.innerHTML = html;
}

function displayModelMetrics(results) {
    modelsGrid.innerHTML = '';
    
    results.forEach((result, index) => {
        if (result.error) {
            const modelShortName = result.model.split('/')[1] || result.model;
            const isFirst = index === 0;
            
            let helpContent = '';
            if (result.requires_manual_switch && result.instruction) {
                // Показываем детальную инструкцию по переключению
                const currentShort = result.current_loaded ? 
                    (result.current_loaded.split('/')[1] || result.current_loaded) : 'неизвестно';
                
                helpContent = `
                    <div class="error-help instruction">
                        <strong>📋 Как переключить модель:</strong>
                        <ol class="instruction-list">
                            <li>Откройте <strong>LM Studio</strong></li>
                            <li>Выгрузите модель: <code>${currentShort}</code></li>
                            <li>Загрузите модель: <code>${modelShortName}</code></li>
                            <li>Вернитесь сюда и загрузите изображение снова</li>
                        </ol>
                    </div>
                `;
            } else {
                helpContent = `
                    <div class="error-help">
                        <p>💡 Загрузите модель <code>${result.model}</code> в LM Studio</p>
                    </div>
                `;
            }
            
            modelsGrid.innerHTML += `
                <div class="model-card error">
                    <div class="model-header">
                        <h3>${modelShortName}</h3>
                        <span class="model-badge error-badge">${isFirst ? 'Модель 1' : 'Модель 2'}</span>
                    </div>
                    <div class="error-box">
                        <div class="error-icon">⚠️</div>
                        <div class="error-details">
                            <strong>Модель не активна</strong>
                            <p class="error-text">${result.error}</p>
                        </div>
                    </div>
                    ${helpContent}
                </div>
            `;
            return;
        }
        
        const modelShortName = result.model.split('/')[1] || result.model;
        const isFirst = index === 0;
        
        const card = document.createElement('div');
        card.className = 'model-card';
        card.innerHTML = `
            <div class="model-header">
                <h3>${modelShortName}</h3>
                <span class="model-badge">${isFirst ? 'Модель 1' : 'Модель 2'}</span>
            </div>
            
            <div class="entity-result">
                <div class="entity-label">Обнаружено:</div>
                <div class="entity-value">${result.entity}</div>
            </div>
            
            <div class="metrics-grid">
                <div class="metric">
                    <span class="metric-label">⏱️ Время</span>
                    <span class="metric-value">${result.processing_time}с</span>
                </div>
                
                ${result.tokens_per_second ? `
                <div class="metric">
                    <span class="metric-label">🚀 Скорость</span>
                    <span class="metric-value">${result.tokens_per_second} т/с</span>
                </div>
                ` : ''}
                
                ${result.prompt_tokens ? `
                <div class="metric">
                    <span class="metric-label">📝 Токенов (prompt)</span>
                    <span class="metric-value">${result.prompt_tokens}</span>
                </div>
                ` : ''}
                
                ${result.completion_tokens ? `
                <div class="metric">
                    <span class="metric-label">✍️ Токенов (completion)</span>
                    <span class="metric-value">${result.completion_tokens}</span>
                </div>
                ` : ''}
                
                ${result.total_tokens ? `
                <div class="metric">
                    <span class="metric-label">📊 Всего токенов</span>
                    <span class="metric-value">${result.total_tokens}</span>
                </div>
                ` : ''}
                
                <div class="metric">
                    <span class="metric-label">🌡️ Температура</span>
                    <span class="metric-value">${result.temperature}</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">🎯 Макс. токенов</span>
                    <span class="metric-value">${result.max_tokens}</span>
                </div>
            </div>
        `;
        
        modelsGrid.appendChild(card);
    });
}

function createModelCard(result) {
    const modelShortName = result.model.split('/')[1] || result.model;
    const card = document.createElement('div');
    card.className = 'model-card';
    
    card.innerHTML = `
        <div class="model-header">
            <h3 class="model-title">${modelShortName}</h3>
        </div>
        
        <div class="model-result">
            <div class="result-label">Результат:</div>
            <div class="result-value">${result.result}</div>
        </div>
        
        <div class="model-metrics">
            <div class="metric">
                <span class="metric-label">⏱️ Время обработки</span>
                <span class="metric-value">${result.processing_time ? result.processing_time.toFixed(3) + ' сек' : 'N/A'}</span>
            </div>
            
            ${result.tokens_per_second ? `
            <div class="metric">
                <span class="metric-label">⚡ Скорость</span>
                <span class="metric-value">${result.tokens_per_second.toFixed(2)} tok/s</span>
            </div>
            ` : ''}
            
            ${result.prompt_tokens ? `
            <div class="metric">
                <span class="metric-label">📝 Prompt токены</span>
                <span class="metric-value">${result.prompt_tokens}</span>
            </div>
            ` : ''}
            
            ${result.completion_tokens ? `
            <div class="metric">
                <span class="metric-label">💬 Ответ токены</span>
                <span class="metric-value">${result.completion_tokens}</span>
            </div>
            ` : ''}
            
            ${result.total_tokens ? `
            <div class="metric">
                <span class="metric-label">📊 Всего токенов</span>
                <span class="metric-value">${result.total_tokens}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    return card.outerHTML;
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'flex';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
}
