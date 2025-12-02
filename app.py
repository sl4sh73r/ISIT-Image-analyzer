from flask import Flask, request, jsonify, render_template
import requests
import base64
import os
import time
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from sklearn.metrics import confusion_matrix
import numpy as np
from flask_cors import CORS

# Загрузка переменных окружения из .env файла
load_dotenv()

# Получение API ключа из переменных окружения
API_KEY = os.getenv('API_KEY')

app = Flask(__name__)
CORS(app, origins=["*"], allow_headers=["*"], methods=["*"])  # Разрешаем все origins, headers и methods для CORS
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Создаем папку для загрузок, если её нет
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Настройки корпоративного API
LM_STUDIO_BASE_URL = "https://llama.sndi.my"
LM_STUDIO_URL = f"{LM_STUDIO_BASE_URL}/api/v1/chat/completions"
LM_STUDIO_MODELS_URL = f"{LM_STUDIO_BASE_URL}/api/v1/models"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}
MODELS = []  # Будет заполняться динамически из API

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

def load_vision_models():
    """Загружает список моделей с поддержкой vision из корпоративного API"""
    global MODELS
    max_retries = 3
    retry_delay = 2
    
    # Если модели уже загружены, возвращаем их
    if MODELS:
        return MODELS
    
    for attempt in range(max_retries):
        try:
            print(f"🔄 Попытка {attempt + 1}/{max_retries} загрузки моделей...")
            response = requests.get(LM_STUDIO_MODELS_URL, headers=HEADERS, timeout=15)
            response.raise_for_status()
            models_data = response.json()
            
            # Получаем все модели и фильтруем только с vision
            all_models = models_data.get('data', [])
            vision_models = []
            
            for model in all_models:
                info = model.get('info', {})
                meta = info.get('meta', {})
                capabilities = meta.get('capabilities', {})
                
                if capabilities.get('vision', False):
                    vision_models.append(model['id'])
            
            MODELS = vision_models
            print(f"✓ Загружено {len(MODELS)} моделей с поддержкой vision: {MODELS}")
            return MODELS  # Успешно загрузили, возвращаем список
            
        except Exception as e:
            print(f"✗ Попытка {attempt + 1} не удалась: {e}")
            if attempt < max_retries - 1:
                print(f"⏳ Ждем {retry_delay} секунд перед следующей попыткой...")
                time.sleep(retry_delay)
            else:
                print("❌ Все попытки исчерпаны, используем fallback модели")
    
    # Fallback на известные модели
    MODELS = ["Qwen3-VL-235B-A22B-Instruct", "google/gemma-3-27b-it"]
    print(f"⚠ Используем fallback модели: {MODELS}")
    return MODELS

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_loaded_model():
    """Для корпоративного API модели всегда доступны - возвращаем первую из списка"""
    return MODELS[0] if MODELS else None

def test_model_availability(model_name):
    """Для корпоративного API модели всегда доступны"""
    return model_name in MODELS

def check_if_model_actually_loaded(model_name):
    """Для корпоративного API модели всегда загружены"""
    return model_name in MODELS

def load_model(model_name):
    """Для корпоративного API модели всегда доступны"""
    if model_name in MODELS:
        print(f"✓ Модель {model_name} доступна в корпоративном API")
        return True
    else:
        print(f"✗ Модель {model_name} не найдена в списке доступных")
        return False

def unload_model():
    """Для корпоративного API выгрузка не требуется"""
    print("Корпоративный API: выгрузка моделей не требуется")
    return True

def get_entity_from_image(image_path, model_name, mode='description', classification_settings=None):
    """Определяет сущность на изображении через корпоративный API"""
    try:
        # Загружаем модели, если они еще не загружены
        load_vision_models()
        
        # Проверяем, что модель поддерживается
        if model_name not in MODELS:
            return {
                "error": f"Модель {model_name} не поддерживается в корпоративном API"
            }

        # Читаем и кодируем изображение в base64
        with open(image_path, "rb") as img_file:
            img_b64 = base64.b64encode(img_file.read()).decode("utf-8")

        # Определяем MIME-тип
        ext = image_path.rsplit('.', 1)[1].lower()
        mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"

        # Формируем промпт в зависимости от режима
        if mode == 'classification' and classification_settings:
            positive_class = classification_settings.get('positiveClass', 'Самолет')
            negative_class = classification_settings.get('negativeClass', 'Не самолет')
            prompt_text = f"Определи, что изображено на картинке. Это {positive_class} или {negative_class}? Ответь только одним словом: '{positive_class}' или '{negative_class}'."
        else:
            prompt_text = "Определи, что изображено на картинке. Ответь только одним словом или короткой фразой — только название сущности, без пояснений."

        # Формируем запрос к корпоративному API
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{img_b64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt_text
                        }
                    ]
                }
            ],
            "max_tokens": 30,
            "temperature": 0.2
        }

        # Засекаем время начала запроса
        start_time = time.time()

        response = requests.post(LM_STUDIO_URL, json=payload, headers=HEADERS, timeout=120)
        response.raise_for_status()
        result = response.json()

        # Логируем полный ответ API для отладки
        print("[DEBUG] API Response:", result)

        # Логируем ошибки, если они есть
        if "error" in result:
            print("[ERROR] API Error:", result["error"])

        # Вычисляем время обработки
        end_time = time.time()
        processing_time = round(end_time - start_time, 3)

        # Извлекаем ответ модели и метрики
        entity = result["choices"][0]["message"]["content"].strip()

        # Собираем метрики
        metrics = {
            "entity": entity,
            "model": model_name,
            "processing_time": processing_time,
            "temperature": 0.2,
            "max_tokens": 30,
            "mode": mode,
            "model_info": {
                "name": model_name,
                "provider": model_name.split('/')[0] if '/' in model_name else 'corporate',
                "model_short": model_name.split('/')[1] if '/' in model_name else model_name,
                "api_endpoint": LM_STUDIO_URL,
                "request_type": "vision-language"
            }
        }

        # Добавляем информацию о токенах, если доступна
        if "usage" in result:
            usage = result["usage"]
            metrics["prompt_tokens"] = usage.get("prompt_tokens", 0)
            metrics["completion_tokens"] = usage.get("completion_tokens", 0)
            metrics["total_tokens"] = usage.get("total_tokens", 0)

            # Вычисляем скорость генерации (токенов в секунду)
            if processing_time > 0 and metrics["completion_tokens"] > 0:
                metrics["tokens_per_second"] = round(metrics["completion_tokens"] / processing_time, 2)

        # Добавляем информацию о запросе
        metrics["request_info"] = {
            "image_size": len(img_b64),
            "mime_type": mime_type,
            "api_response_time": processing_time,
            "status": "success"
        }

        return metrics

    except requests.exceptions.RequestException as e:
        return {"error": f"Ошибка подключения к корпоративному API: {str(e)}"}
    except Exception as e:
        return {"error": f"Ошибка обработки изображения: {str(e)}"}

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/api/vlm-models', methods=['GET'])
def get_vlm_models():
    """Получить список всех VLM (vision) моделей из корпоративного API"""
    try:
        # Загружаем модели, если они еще не загружены
        load_vision_models()
        
        response = requests.get(LM_STUDIO_MODELS_URL, headers=HEADERS, timeout=10)
        response.raise_for_status()
        models_data = response.json()
        
        # Получаем все модели и фильтруем только с vision
        all_models = models_data.get('data', [])
        vlm_models = []
        
        for model in all_models:
            info = model.get('info', {})
            meta = info.get('meta', {})
            capabilities = meta.get('capabilities', {})
            
            if capabilities.get('vision', False):
                vlm_models.append({
                    'id': model['id'],
                    'name': model['id'],
                    'publisher': model['id'].split('/')[0] if '/' in model['id'] else 'unknown',
                    'arch': 'unknown',
                    'state': 'loaded',
                    'quantization': '',
                    'max_context': model.get('max_model_len', 0),
                    'loaded': True
                })
        
        return jsonify({
            'status': 'ok',
            'models': vlm_models,
            'total': len(vlm_models),
            'loaded_count': len(vlm_models)
        })
    except requests.exceptions.Timeout:
        return jsonify({
            'status': 'error',
            'message': 'Таймаут подключения к корпоративному API'
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            'status': 'error',
            'message': 'Не удалось подключиться к корпоративному API'
        }), 503
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Корпоративный API недоступен: {str(e)}'
        }), 500

@app.route('/api/check-models', methods=['GET'])
def check_models():
    """Проверка доступности моделей в корпоративном API"""
    try:
        # В корпоративном API все модели всегда доступны
        available_models = []
        for model_name in MODELS:
            available_models.append({
                'name': model_name,
                'short_name': model_name.split('/')[1] if '/' in model_name else model_name,
                'available': True,
                'currently_loaded': True  # Все модели доступны
            })
        
        return jsonify({
            'status': 'ok',
            'models': available_models,
            'loaded_count': len(MODELS),
            'total_count': len(MODELS),
            'all_loaded': True,
            'current_model': MODELS[0],
            'auto_switching': True,
            'note': 'Все модели доступны в корпоративном API'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'suggestion': 'Проверьте подключение к корпоративному API'
        }), 500

@app.route('/api/active-model', methods=['GET'])
def get_active_model():
    """Получить текущую активную модель"""
    try:
        current = get_loaded_model()
        
        return jsonify({
            'success': True,
            'active_model': current,
            'active_model_short': current.split('/')[1] if current and '/' in current else current,
            'available_models': MODELS,
            'manual_switching_required': False,  # В корпоративном API переключение автоматическое
            'instructions': {}
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/load-model', methods=['POST'])
def api_load_model():
    """В корпоративном API модели всегда доступны"""
    data = request.get_json()
    model_id = data.get('model_id')
    
    if not model_id:
        return jsonify({'success': False, 'error': 'model_id обязателен'}), 400
    
    if model_id in MODELS:
        return jsonify({
            'success': True,
            'message': f'Модель {model_id} доступна в корпоративном API',
            'already_loaded': True
        })
    else:
        return jsonify({
            'success': False,
            'error': f'Модель {model_id} не поддерживается'
        }), 400

@app.route('/api/unload-model', methods=['POST'])
def api_unload_model():
    """В корпоративном API выгрузка не требуется"""
    data = request.get_json()
    model_id = data.get('model_id')
    
    if not model_id:
        return jsonify({'success': False, 'error': 'model_id обязателен'}), 400
    
    return jsonify({
        'success': True,
        'message': f'Модель {model_id} доступна в корпоративном API',
        'already_unloaded': True
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """Анализ одного изображения выбранной моделью"""
    if 'image' not in request.files:
        return jsonify({'error': 'Изображение не найдено'}), 400
    
    file = request.files['image']
    model_name = request.form.get('model')
    mode = request.form.get('mode', 'description')
    positive_class = request.form.get('positiveClass', 'Самолет')
    negative_class = request.form.get('negativeClass', 'Не самолет')
    ground_truth = request.form.get('groundTruth', '')  # Для режима классификации
    
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400
    
    if not model_name:
        return jsonify({'error': 'Модель не указана'}), 400
    
    # Проверяем модель
    if model_name not in MODELS:
        return jsonify({'error': f'Модель {model_name} не поддерживается'}), 400
    
    try:
        # Сохраняем файл
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Настройки классификации
            classification_settings = None
            if mode == 'classification':
                classification_settings = {
                    'positiveClass': positive_class,
                    'negativeClass': negative_class
                }
            
            # Анализируем изображение выбранной моделью
            result = get_entity_from_image(filepath, model_name, mode, classification_settings)
            
            if "error" in result:
                response_data = {
                    'success': False,
                    'results': [{
                        'index': 0,
                        'filename': filename,
                        'success': False,
                        'error': result["error"],
                        'current_loaded': result.get("current_loaded"),
                        'requires_manual_switch': result.get("requires_manual_load", False)
                    }]
                }
            else:
                # Определяем правильность ответа в режиме классификации
                is_correct = None
                if mode == 'classification' and ground_truth:
                    entity_lower = result.get('entity', '').lower().strip()
                    positive_lower = positive_class.lower().strip()
                    negative_lower = negative_class.lower().strip()
                    
                    print(f"[DEBUG] Classification check:")
                    print(f"  Entity: '{entity_lower}'")
                    print(f"  Ground truth: '{ground_truth}'")
                    print(f"  Positive class: '{positive_lower}'")
                    print(f"  Negative class: '{negative_lower}'")
                    
                    # Логика: проверяем, к какому классу ближе ответ модели
                    if ground_truth == 'positive':
                        # Ожидаем положительный класс
                        # Проверяем, что ответ больше похож на положительный класс
                        positive_match = positive_lower in entity_lower and not (negative_lower in entity_lower and entity_lower.startswith(negative_lower.split()[0]))
                        is_correct = positive_match
                    elif ground_truth == 'negative':
                        # Ожидаем отрицательный класс
                        # Проверяем, что ответ больше похож на отрицательный класс
                        negative_match = negative_lower in entity_lower or entity_lower.startswith(negative_lower.split()[0])
                        is_correct = negative_match
                    else:
                        is_correct = False
                    
                    print(f"  Result: is_correct = {is_correct}")
                
                
                response_data = {
                    'success': True,
                    'results': [{
                        'index': 0,
                        'filename': filename,
                        'success': True,
                        'entity': result.get('entity', 'N/A'),
                        'processing_time': result.get('processing_time', 0),
                        'tokens_per_second': result.get('tokens_per_second'),
                        'total_tokens': result.get('total_tokens'),
                        'model': model_name,
                        'mode': mode,
                        'classification_correct': is_correct,
                        'ground_truth': ground_truth if mode == 'classification' else None
                    }]
                }
                
        except Exception as e:
            response_data = {
                'success': False,
                'results': [{
                    'index': 0,
                    'filename': filename,
                    'success': False,
                    'error': str(e)
                }]
            }
        finally:
            # Удаляем временный файл
            if os.path.exists(filepath):
                os.remove(filepath)
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-mode-settings', methods=['GET'])
def get_mode_settings():
    """Получить текущие настройки режима работы"""
    return jsonify({
        'currentMode': 'description',  # По умолчанию
        'classificationSettings': {
            'positiveClass': 'Самолет',
            'negativeClass': 'Не самолет'
        }
    })

@app.route('/api/model-comparison', methods=['POST'])
def get_model_comparison():
    """Вычисляет метрики сравнения моделей на основе результатов анализа"""
    data = request.get_json()
    results = data.get('results', [])
    mode = data.get('mode', 'description')
    classification_settings = data.get('classificationSettings', {})
    ground_truth_data = data.get('groundTruth', {})  # Словарь filename -> ground_truth

    if not results:
        return jsonify({'error': 'Необходимо предоставить результаты анализа'}), 400

    try:
        # Группируем результаты по изображениям
        image_results = {}
        model_names = set()

        for result in results:
            image_name = result.get('filename', 'unknown')
            model_name = result.get('model', 'unknown')
            entity = result.get('entity', '')
            success = result.get('success', False)

            model_names.add(model_name)

            if image_name not in image_results:
                image_results[image_name] = {}

            image_results[image_name][model_name] = {
                'entity': entity,
                'success': success,
                'processing_time': result.get('processing_time', 0),
                'tokens_per_second': result.get('tokens_per_second', 0),
                'total_tokens': result.get('total_tokens', 0)
            }

        model_names = sorted(list(model_names))

        # Вычисляем метрики сравнения
        comparison_metrics = {
            'total_images': len(image_results),
            'models_compared': len(model_names),
            'model_names': model_names,
            'agreement_matrix': [],
            'performance_metrics': {},
            'mode': mode
        }

        # Для режима классификации добавляем информацию о правильности ответов
        if mode == 'classification':
            positive_class = classification_settings.get('positiveClass', 'Самолет')
            negative_class = classification_settings.get('negativeClass', 'Не самолет')
            comparison_metrics['classification_settings'] = {
                'positive_class': positive_class,
                'negative_class': negative_class
            }

        # Матрица согласия (confusion matrix для ответов)
        agreement_matrix = []
        for i, model1 in enumerate(model_names):
            row = []
            for j, model2 in enumerate(model_names):
                if i == j:
                    # Диагональ - успешные ответы модели
                    successful_answers = sum(1 for img_results in image_results.values()
                                           if img_results.get(model1, {}).get('success', False))
                    row.append(successful_answers)
                else:
                    # Сравнение ответов двух моделей
                    agreements = 0
                    for img_results in image_results.values():
                        model1_result = img_results.get(model1, {})
                        model2_result = img_results.get(model2, {})

                        if (model1_result.get('success', False) and
                            model2_result.get('success', False) and
                            model1_result.get('entity', '').lower() == model2_result.get('entity', '').lower()):
                            agreements += 1
                    row.append(agreements)
            agreement_matrix.append(row)

        comparison_metrics['agreement_matrix'] = agreement_matrix

        # Метрики производительности для каждой модели
        for model_name in model_names:
            model_times = []
            model_tokens_per_sec = []
            model_total_tokens = []
            successful_count = 0
            correct_predictions = 0  # Для режима классификации

            for img_name, img_results in image_results.items():
                model_result = img_results.get(model_name, {})
                if model_result.get('success', False):
                    successful_count += 1
                    model_times.append(model_result.get('processing_time', 0))
                    if model_result.get('tokens_per_second', 0) > 0:
                        model_tokens_per_sec.append(model_result.get('tokens_per_second', 0))
                    model_total_tokens.append(model_result.get('total_tokens', 0))

                    # Для режима классификации проверяем правильность
                    if mode == 'classification':
                        ground_truth = ground_truth_data.get(img_name)
                        if ground_truth:
                            entity_lower = model_result.get('entity', '').lower().strip()
                            positive_lower = positive_class.lower()
                            negative_lower = negative_class.lower()
                            
                            # Проверяем, соответствует ли ответ правильному классу
                            if ground_truth == 'positive':
                                # Проверяем, что ответ больше похож на положительный класс
                                positive_match = positive_lower in entity_lower and not (negative_lower in entity_lower and entity_lower.startswith(negative_lower.split()[0]))
                                if positive_match:
                                    correct_predictions += 1
                            elif ground_truth == 'negative':
                                # Проверяем, что ответ больше похож на отрицательный класс  
                                negative_match = negative_lower in entity_lower or entity_lower.startswith(negative_lower.split()[0])
                                if negative_match:
                                    correct_predictions += 1

            comparison_metrics['performance_metrics'][model_name] = {
                'successful_predictions': successful_count,
                'total_predictions': len(image_results),
                'success_rate': round(successful_count / len(image_results) * 100, 2) if image_results else 0,
                'avg_processing_time': round(sum(model_times) / len(model_times), 3) if model_times else 0,
                'avg_tokens_per_second': round(sum(model_tokens_per_sec) / len(model_tokens_per_sec), 2) if model_tokens_per_sec else 0,
                'total_tokens_used': sum(model_total_tokens),
                'avg_tokens_used': round(sum(model_total_tokens) / len(model_total_tokens), 1) if model_total_tokens else 0
            }

            # Добавляем метрики точности для режима классификации
            if mode == 'classification':
                comparison_metrics['performance_metrics'][model_name]['correct_predictions'] = correct_predictions
                comparison_metrics['performance_metrics'][model_name]['accuracy'] = round(correct_predictions / len(image_results) * 100, 2) if image_results else 0

        return jsonify(comparison_metrics)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def calculate_comparison(results):
    """Вычисляет сравнительные метрики между моделями"""
    comparison = {}
    
    # Фильтруем только успешные результаты
    successful_results = [r for r in results if "error" not in r]
    
    if len(successful_results) < 2:
        return comparison
    
    model1, model2 = successful_results[0], successful_results[1]
    
    # Сравнение времени обработки
    if "processing_time" in model1 and "processing_time" in model2:
        time_diff = abs(model1["processing_time"] - model2["processing_time"])
        faster_model = model1["model"] if model1["processing_time"] < model2["processing_time"] else model2["model"]
        comparison["time_difference"] = round(time_diff, 3)
        comparison["faster_model"] = faster_model
        
        # Процентная разница
        avg_time = (model1["processing_time"] + model2["processing_time"]) / 2
        if avg_time > 0:
            comparison["time_difference_percent"] = round((time_diff / avg_time) * 100, 1)
    
    # Сравнение токенов
    if "tokens_per_second" in model1 and "tokens_per_second" in model2:
        faster_tokens_model = model1["model"] if model1["tokens_per_second"] > model2["tokens_per_second"] else model2["model"]
        comparison["faster_tokens_model"] = faster_tokens_model
        comparison["tokens_per_second_diff"] = round(abs(model1["tokens_per_second"] - model2["tokens_per_second"]), 2)
    
    # Сравнение использования токенов
    if "total_tokens" in model1 and "total_tokens" in model2:
        comparison["total_tokens_diff"] = abs(model1["total_tokens"] - model2["total_tokens"])
        comparison["more_efficient_model"] = model1["model"] if model1["total_tokens"] < model2["total_tokens"] else model2["model"]
    
    # Проверка совпадения ответов
    if "entity" in model1 and "entity" in model2:
        comparison["answers_match"] = model1["entity"].lower() == model2["entity"].lower()
        comparison["answer_similarity"] = "identical" if comparison["answers_match"] else "different"
    
    return comparison

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5003)
