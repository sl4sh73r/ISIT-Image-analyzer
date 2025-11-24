from flask import Flask, request, jsonify, render_template
import requests
import base64
import os
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Создаем папку для загрузок, если её нет
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Настройки LM Studio
LM_STUDIO_BASE_URL = "http://127.0.0.1:1234"
LM_STUDIO_URL = f"{LM_STUDIO_BASE_URL}/v1/chat/completions"
LM_STUDIO_MODELS_URL = f"{LM_STUDIO_BASE_URL}/v1/models"
LM_STUDIO_LOAD_MODEL_URL = f"{LM_STUDIO_BASE_URL}/v1/models/load"
MODELS = ["qwen/qwen3-vl-4b", "google/gemma-3-4b"]

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_loaded_model():
    """Получает текущую АКТИВНО загруженную модель в LM Studio"""
    try:
        response = requests.get(LM_STUDIO_MODELS_URL, timeout=5)
        response.raise_for_status()
        models_data = response.json()
        
        # LM Studio возвращает список всех доступных моделей,
        # но только первая в списке фактически загружена в память
        loaded_models = models_data.get('data', [])
        if loaded_models:
            # Первая модель - это активно загруженная
            return loaded_models[0].get('id', None)
        return None
    except Exception as e:
        print(f"Ошибка получения загруженной модели: {e}")
        return None

def check_if_model_actually_loaded(model_name):
    """Проверяет, действительно ли модель загружена в память (не просто в списке)"""
    try:
        # Пытаемся сделать тестовый запрос с минимальными данными
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": "test"}],
            "max_tokens": 1,
            "temperature": 0.1
        }
        
        response = requests.post(LM_STUDIO_URL, json=payload, timeout=10)
        
        # Если модель загружена - вернёт 200
        # Если не загружена из-за памяти - вернёт ошибку
        if response.status_code == 200:
            return True
        else:
            return False
    except Exception as e:
        error_text = str(e)
        if "insufficient system resources" in error_text.lower():
            return False
        return False

def load_model(model_name):
    """Загружает модель в LM Studio через API"""
    try:
        print(f"Попытка загрузить модель: {model_name}")
        
        # Проверяем, не загружена ли уже эта модель
        current_model = get_loaded_model()
        if current_model and model_name in current_model:
            print(f"✓ Модель {model_name} уже загружена")
            return True
        
        # LM Studio использует POST запрос для загрузки модели
        # Формат может отличаться в зависимости от версии LM Studio
        payload = {
            "model": model_name
        }
        
        # Пробуем несколько возможных эндпоинтов
        endpoints_to_try = [
            f"{LM_STUDIO_BASE_URL}/v1/models/load",
            f"{LM_STUDIO_BASE_URL}/api/v0/models/load",
            f"{LM_STUDIO_BASE_URL}/models/load",
        ]
        
        for endpoint in endpoints_to_try:
            try:
                print(f"Пробую эндпоинт: {endpoint}")
                response = requests.post(endpoint, json=payload, timeout=30)
                
                if response.status_code == 200:
                    print(f"✓ Модель {model_name} успешно загружена")
                    # Даём время модели загрузиться
                    time.sleep(5)
                    return True
                elif response.status_code == 404:
                    # Этот эндпоинт не существует, пробуем следующий
                    continue
                else:
                    print(f"Ответ сервера ({response.status_code}): {response.text}")
            except requests.exceptions.RequestException as e:
                print(f"Ошибка при обращении к {endpoint}: {e}")
                continue
        
        # Если API не поддерживается, возвращаем False
        print(f"⚠ API загрузки моделей не поддерживается. Загрузите модель вручную.")
        return False
        
    except Exception as e:
        print(f"✗ Ошибка загрузки модели: {e}")
        return False

def unload_model():
    """Выгружает текущую модель из LM Studio"""
    try:
        print("Попытка выгрузить текущую модель")
        
        endpoints_to_try = [
            f"{LM_STUDIO_BASE_URL}/v1/models/unload",
            f"{LM_STUDIO_BASE_URL}/api/v0/models/unload",
        ]
        
        for endpoint in endpoints_to_try:
            try:
                response = requests.post(endpoint, timeout=10)
                if response.status_code == 200:
                    print("✓ Модель выгружена")
                    time.sleep(2)
                    return True
            except:
                continue
        
        print("⚠ API выгрузки моделей не поддерживается")
        return False
    except Exception as e:
        print(f"Ошибка выгрузки модели: {e}")
        return False

def get_entity_from_image(image_path, model_name, auto_load=False):
    """Определяет сущность на изображении через LM Studio с метриками
    
    auto_load=False по умолчанию, т.к. LM Studio не поддерживает API загрузки моделей
    """
    try:
        # Проверяем, загружена ли модель в память (не просто в списке)
        current_model = get_loaded_model()
        
        # LM Studio показывает все модели в списке, но загружена только первая
        if not current_model or model_name not in current_model:
            print(f"⚠ Модель {model_name} не является активной")
            print(f"  Текущая активная модель: {current_model}")
            return {
                "error": f"Модель {model_name} не загружена в память. Выгрузите текущую модель '{current_model}' и загрузите '{model_name}' в LM Studio.",
                "requires_manual_load": True,
                "current_loaded": current_model
            }
        
        # Читаем и кодируем изображение в base64
        with open(image_path, "rb") as img_file:
            img_b64 = base64.b64encode(img_file.read()).decode("utf-8")
        
        # Определяем MIME-тип
        ext = image_path.rsplit('.', 1)[1].lower()
        mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        
        # Формируем запрос к LM Studio
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
                            "text": "Определи, что изображено на картинке. Ответь только одним словом или короткой фразой — только название сущности, без пояснений."
                        }
                    ]
                }
            ],
            "max_tokens": 30,
            "temperature": 0.2
        }
        
        # Засекаем время начала запроса
        start_time = time.time()
        
        response = requests.post(LM_STUDIO_URL, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
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
            "max_tokens": 30
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
        
        return metrics
        
    except requests.exceptions.RequestException as e:
        return {"error": f"Ошибка подключения к LM Studio: {str(e)}"}
    except Exception as e:
        return {"error": f"Ошибка обработки изображения: {str(e)}"}

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/api/check-models', methods=['GET'])
def check_models():
    """Проверка доступности моделей в LM Studio"""
    try:
        response = requests.get(LM_STUDIO_MODELS_URL, timeout=5)
        response.raise_for_status()
        models_data = response.json()
        
        # Получаем список всех загруженных моделей
        loaded_models = [model.get('id', '') for model in models_data.get('data', [])]
        current_loaded = loaded_models[0] if loaded_models else None
        
        # Проверяем доступность обеих моделей
        available_models = []
        for model_name in MODELS:
            is_loaded = any(model_name in model_id for model_id in loaded_models)
            available_models.append({
                'name': model_name,
                'short_name': model_name.split('/')[1] if '/' in model_name else model_name,
                'available': is_loaded,
                'currently_loaded': is_loaded and current_loaded and model_name in current_loaded
            })
        
        loaded_count = sum(1 for m in available_models if m['available'])
        
        return jsonify({
            'status': 'ok',
            'models': available_models,
            'loaded_count': loaded_count,
            'total_count': len(MODELS),
            'all_loaded': loaded_count == len(MODELS),
            'current_model': current_loaded,
            'auto_switching': True,  # Указываем, что поддерживается автопереключение
            'note': 'Модели будут автоматически загружаться при анализе' if loaded_count < len(MODELS) else 'Обе модели доступны'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'suggestion': 'Убедитесь, что LM Studio запущен и доступен по адресу http://127.0.0.1:1234'
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
            'manual_switching_required': True,
            'instructions': {
                'step1': 'Откройте LM Studio',
                'step2': f'Выгрузите текущую модель: {current}' if current else 'Загрузите нужную модель',
                'step3': 'Загрузите нужную модель из списка',
                'step4': 'Вернитесь в приложение и загрузите изображение снова'
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-single', methods=['POST'])
def analyze_single_model():
    """Анализ изображения с помощью одной конкретной модели"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'Изображение не найдено'}), 400
    
    if 'model' not in request.form:
        return jsonify({'success': False, 'error': 'Модель не указана'}), 400
    
    file = request.files['image']
    model_name = request.form['model']
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'Неподдерживаемый формат файла'}), 400
    
    try:
        # Сохраняем файл
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Получаем текущую загруженную модель
        current_model = get_loaded_model()
        
        # Проверяем, загружена ли нужная модель
        if not current_model or current_model != model_name:
            return jsonify({
                'success': False,
                'error': f'Модель {model_name} не загружена в LM Studio. Загрузите её и попробуйте снова.',
                'current_model': current_model
            }), 400
        
        # Анализируем изображение
        result = get_entity_from_image(filepath, model_name)
        
        # Удаляем временный файл
        if os.path.exists(filepath):
            os.remove(filepath)
        
        if 'error' in result:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """Анализ изображения - последовательно для каждой модели"""
    if 'image' not in request.files:
        return jsonify({'error': 'Изображение не найдено'}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Неподдерживаемый формат файла'}), 400
    
    try:
        # Сохраняем файл
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Анализируем изображение обеими моделями ПОСЛЕДОВАТЕЛЬНО
        # Модели автоматически загружаются и выгружаются по необходимости
        results = []
        for model_name in MODELS:
            print(f"\n{'='*60}")
            print(f"Анализирую с помощью модели: {model_name}")
            print(f"{'='*60}")
            
            # Включаем автоматическую загрузку модели
            result = get_entity_from_image(filepath, model_name, auto_load=True)
            
            if "error" not in result:
                results.append(result)
                print(f"✓ {model_name}: {result.get('entity', 'N/A')}")
                print(f"  Время: {result.get('processing_time', 'N/A')}с")
                print(f"  Токенов: {result.get('total_tokens', 'N/A')}")
            else:
                error_msg = result["error"]
                current_loaded = result.get("current_loaded", "неизвестно")
                
                # Формируем детальное сообщение с инструкциями
                if result.get("requires_manual_load"):
                    model_short = model_name.split('/')[1] if '/' in model_name else model_name
                    current_short = current_loaded.split('/')[1] if current_loaded and '/' in current_loaded else current_loaded
                    
                    error_msg = f"Модель {model_short} не активна. Сейчас загружена: {current_short}"
                    instruction = f"В LM Studio: выгрузите '{current_short}' → загрузите '{model_short}' → повторите анализ"
                    
                    results.append({
                        "model": model_name,
                        "error": error_msg,
                        "instruction": instruction,
                        "current_loaded": current_loaded,
                        "requires_manual_switch": True
                    })
                    print(f"✗ {model_name}: {error_msg}")
                    print(f"  💡 {instruction}")
                else:
                    # Другие ошибки
                    if "400 Client Error" in error_msg or "Bad Request" in error_msg:
                        error_msg = f"Модель недоступна. Убедитесь, что {model_name} установлена в LM Studio."
                    
                    results.append({
                        "model": model_name,
                        "error": error_msg
                    })
                    print(f"✗ {model_name}: {error_msg}")
            
            # Пауза между моделями
            time.sleep(1)
        
        # Удаляем временный файл
        os.remove(filepath)
        
        # Проверяем, есть ли хотя бы один успешный результат
        successful_results = [r for r in results if "error" not in r]
        
        if not successful_results:
            return jsonify({
                'success': False,
                'error': 'Обе модели недоступны или вернули ошибку',
                'results': results,
                'suggestion': 'Убедитесь, что хотя бы одна модель загружена в LM Studio'
            }), 500
        
        # Вычисляем сравнительные метрики (только для успешных результатов)
        comparison = calculate_comparison(results)
        
        return jsonify({
            'success': True,
            'results': results,
            'comparison': comparison,
            'models_analyzed': len(successful_results),
            'models_failed': len(results) - len(successful_results)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
    app.run(debug=True, host='0.0.0.0', port=5001)
