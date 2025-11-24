#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск LM Studio Image Analyzer (SDK Version)${NC}"
echo ""

# Проверка виртуального окружения
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  Виртуальное окружение не найдено${NC}"
    echo "   Создаю виртуальное окружение..."
    python3 -m venv .venv
    echo -e "${GREEN}✓ Виртуальное окружение создано${NC}"
fi

# Активация виртуального окружения
echo -e "${BLUE}📦 Активация виртуального окружения...${NC}"
source .venv/bin/activate

# Проверка зависимостей
echo -e "${BLUE}🔍 Проверка зависимостей...${NC}"
if ! python -c "import lmstudio" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Пакет lmstudio не установлен${NC}"
    echo "   Устанавливаю зависимости..."
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Зависимости установлены${NC}"
else
    echo -e "${GREEN}✓ Все зависимости установлены${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Готов к запуску!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Запуск приложения
echo -e "${BLUE}🌐 Запуск Flask приложения...${NC}"
echo -e "${YELLOW}   Откройте браузер: http://127.0.0.1:5001${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

python app.py
