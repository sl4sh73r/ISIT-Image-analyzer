#!/bin/bash

echo "🚀 Переключение на SDK версию приложения"
echo ""

# Проверка, что файлы существуют
if [ ! -f "app.py" ]; then
    echo "❌ Файл app.py не найден"
    exit 1
fi

if [ ! -f "app_sdk.py" ]; then
    echo "❌ Файл app_sdk.py не найден"
    exit 1
fi

# Создание backup REST API версии
echo "📦 Создание backup REST API версии..."
if [ ! -f "app_rest.py" ]; then
    cp app.py app_rest.py
    echo "✅ Backup сохранён в app_rest.py"
else
    echo "⚠️  app_rest.py уже существует, пропускаем backup"
fi

# Замена app.py на SDK версию
echo "🔄 Замена app.py на SDK версию..."
cp app_sdk.py app.py
echo "✅ Замена завершена!"

echo ""
echo "🎉 Готово! Теперь можно запустить приложение:"
echo "   python3 app.py"
echo ""
echo "📝 Заметки:"
echo "   - REST API версия сохранена в app_rest.py"
echo "   - SDK версия теперь в app.py"
echo "   - Оригинальный backup в app_backup.py"
