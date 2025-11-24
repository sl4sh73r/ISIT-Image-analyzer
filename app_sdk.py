from flask import Flask, request, jsonify, render_template
import lmstudio as lms
import base64
import os
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Модели для сравнения
MODELS = ["qwen/qwen3-vl-4b", "google/gemma-3-4b"]
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

# Глобальный клиент LM Studio
lms_client = None
current_loaded_model = None

def init_lms_client():
    """Инициализация клиента LM Studio"""
    global lms_client
    try:
        lms_client = lms.Client()
        print("✓ LM Studio клиент инициализирован")
        return True
    except Exception as e:
        print(f"✗ Ошибка инициализации LM Studio: {e}")
        return False

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_current_model():
    """Получает текущую загруженную модель"""
    global lms_client, current_loaded_model
    try:
        # Используем list() для получения загруженных моделей
        models = lms_client.llm.list()
        if models:
            # Берем первую модель
            first_model = models[0]
            model_id = first_model.identifier if hasattr(first_model, 'identifier') else str(first_model)
            current_loaded_model = model_id
            return model_id
        return None
    except Exception as e:
        print(f"Ошибка получения текущей модели: {e}")
        return current_loaded_model

def analyze_image_with_model(image_path, model_name):
    """Анализирует изображение с помощью указанной модели через LM Studio SDK"""
    global lms_client
    
    try:
        print(f"\n{'='*60}")
        print(f"Загружаю и анализирую с помощью: {model_name}")
        print(f"{'='*60}")
        
        # Читаем изображение
        with open(image_path, "rb") as img_file:
            img_b64 = base64.b64encode(img_file.read()).decode("utf-8")
        
        ext = image_path.rsplit('.', 1)[1].lower()
        mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        
        # Засекаем время начала
        start_time = time.time()
        
        # Загружаем модель через SDK с конфигурацией
        print(f"⏳ Загружаю модель {model_name}...")
        model = lms_client.llm.load_new_instance(
            model_name,
            config={
                "contextLength": 8192,
                "gpu": {
                    "ratio": 1.0  # Используем всю доступную GPU память
                }
            }
        )
        print(f"✓ Модель {model_name} загружена")
        
        # Формируем сообщение с изображением
        messages = [
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
        ]
        
        # Выполняем запрос с параметрами
        print(f"🔄 Обрабатываю изображение...")
        response = model.respond(
            messages,
            config={
                "temperature": 0.2,
                "maxTokens": 30
            }
        )
        
        # Вычисляем время
        end_time = time.time()
        processing_time = round(end_time - start_time, 3)
        
        # Извлекаем ответ
        entity = response.content if hasattr(response, 'content') else str(response)
        entity = entity.strip()
        
        print(f"✓ Результат: {entity}")
        print(f"⏱️  Время: {processing_time}с")
        
        # Пытаемся получить статистику использования
        metrics = {
            "entity": entity,
            "model": model_name,
            "processing_time": processing_time,
            "temperature": 0.2,
            "max_tokens": 30
        }
        
        # Добавляем статистику токенов, если доступна
        if hasattr(response, 'stats'):
            stats = response.stats
            if hasattr(stats, 'prompt_tokens'):
                metrics["prompt_tokens"] = stats.prompt_tokens
            if hasattr(stats, 'completion_tokens'):
                metrics["completion_tokens"] = stats.completion_tokens
            if hasattr(stats, 'total_tokens'):
                metrics["total_tokens"] = stats.total_tokens
                
            # Вычисляем скорость
            if "completion_tokens" in metrics and processing_time > 0:
                metrics["tokens_per_second"] = round(metrics["completion_tokens"] / processing_time, 2)
        
        # Выгружаем модель после использования
        print(f"🔄 Выгружаю модель {model_name}...")
        try:
            model.unload()
            print(f"✓ Модель выгружена")
        except:
            print(f"⚠️  Не удалось выгрузить модель")
        
        return metrics
        
    except Exception as e:
        error_msg = str(e)
        print(f"✗ Ошибка: {error_msg}")
        
        return {
            "error": f"Ошибка при работе с моделью {model_name}: {error_msg}",
            "model": model_name
        }

def calculate_comparison(results):
    """Вычисляет сравнительные метрики"""
    comparison = {}
    
    successful_results = [r for r in results if "error" not in r]
    
    if len(successful_results) < 2:
        return comparison
    
    model1, model2 = successful_results[0], successful_results[1]
    
    # Сравнение времени
    if "processing_time" in model1 and "processing_time" in model2:
        time_diff = abs(model1["processing_time"] - model2["processing_time"])
        faster_model = model1["model"] if model1["processing_time"] < model2["processing_time"] else model2["model"]
        comparison["time_difference"] = round(time_diff, 3)
        comparison["faster_model"] = faster_model
        
        avg_time = (model1["processing_time"] + model2["processing_time"]) / 2
        if avg_time > 0:
            comparison["time_difference_percent"] = round((time_diff / avg_time) * 100, 1)
    
    # Сравнение токенов
    if "tokens_per_second" in model1 and "tokens_per_second" in model2:
        faster_tokens_model = model1["model"] if model1["tokens_per_second"] > model2["tokens_per_second"] else model2["model"]
        comparison["faster_tokens_model"] = faster_tokens_model
        comparison["tokens_per_second_diff"] = round(abs(model1["tokens_per_second"] - model2["tokens_per_second"]), 2)
    
    if "total_tokens" in model1 and "total_tokens" in model2:
        comparison["total_tokens_diff"] = abs(model1["total_tokens"] - model2["total_tokens"])
        comparison["more_efficient_model"] = model1["model"] if model1["total_tokens"] < model2["total_tokens"] else model2["model"]
    
    # Сравнение ответов
    if "entity" in model1 and "entity" in model2:
        comparison["answers_match"] = model1["entity"].lower() == model2["entity"].lower()
        comparison["answer_similarity"] = "identical" if comparison["answers_match"] else "different"
    
    return comparison

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/check-models', methods=['GET'])
def check_models():
    """Проверка доступных моделей"""
    global lms_client
    
    try:
        if not lms_client:
            init_lms_client()
        
        # Получаем список загруженных моделей
        loaded_models = lms_client.llm.list() if lms_client else []
        loaded_ids = [m.identifier if hasattr(m, 'identifier') else str(m) for m in loaded_models]
        
        # Проверяем доступность наших моделей
        available_models = []
        for model_name in MODELS:
            is_loaded = any(model_name in model_id for model_id in loaded_ids)
            available_models.append({
                'name': model_name,
                'short_name': model_name.split('/')[1] if '/' in model_name else model_name,
                'available': is_loaded,
                'currently_loaded': is_loaded
            })
        
        loaded_count = sum(1 for m in available_models if m['available'])
        current = loaded_ids[0] if loaded_ids else None
        
        return jsonify({
            'status': 'ok',
            'models': available_models,
            'loaded_count': loaded_count,
            'total_count': len(MODELS),
            'all_loaded': loaded_count == len(MODELS),
            'current_model': current,
            'auto_switching': True,
            'sdk_enabled': True,
            'note': '🔄 Модели будут автоматически загружаться через LM Studio SDK'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'suggestion': 'Убедитесь, что LM Studio запущен'
        }), 500

@app.route('/api/active-model', methods=['GET'])
def get_active_model():
    """Получить текущую активную модель"""
    try:
        current = get_current_model()
        
        return jsonify({
            'success': True,
            'active_model': current,
            'active_model_short': current.split('/')[1] if current and '/' in current else current,
            'available_models': MODELS,
            'auto_switching': True,
            'sdk_enabled': True,
            'instructions': {
                'step1': 'SDK автоматически загружает модели',
                'step2': 'Просто загрузите изображение',
                'step3': 'Приложение последовательно протестирует обе модели',
                'step4': 'Результаты будут автоматически сравнены'
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """Анализ изображения обеими моделями"""
    if 'image' not in request.files:
        return jsonify({'error': 'Изображение не найдено'}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Неподдерживаемый формат файла'}), 400
    
    try:
        # Инициализируем клиент, если нужно
        if not lms_client:
            if not init_lms_client():
                return jsonify({
                    'success': False,
                    'error': 'Не удалось подключиться к LM Studio'
                }), 500
        
        # Сохраняем файл
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Анализируем обеими моделями последовательно
        results = []
        for model_name in MODELS:
            result = analyze_image_with_model(filepath, model_name)
            results.append(result)
            
            # Пауза между моделями
            time.sleep(1)
        
        # Удаляем временный файл
        os.remove(filepath)
        
        # Проверяем успешность
        successful_results = [r for r in results if "error" not in r]
        
        if not successful_results:
            return jsonify({
                'success': False,
                'error': 'Обе модели вернули ошибку',
                'results': results
            }), 500
        
        # Вычисляем сравнение
        comparison = calculate_comparison(results)
        
        return jsonify({
            'success': True,
            'results': results,
            'comparison': comparison,
            'models_analyzed': len(successful_results),
            'models_failed': len(results) - len(successful_results),
            'sdk_enabled': True
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Инициализируем клиент при запуске
    print("🚀 Запуск приложения...")
    init_lms_client()
    app.run(debug=True, host='0.0.0.0', port=5001)
