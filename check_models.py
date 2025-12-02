import requests
r = requests.get('http://127.0.0.1:1234/v1/models')
if r.status_code == 200:
    models = r.json()['data']
    print(f"Первая модель: {models[0]['id']}")
    for i, m in enumerate(models[:2]):  # Показываем первые две
        print(f"{i+1}. {m['id']}")
else:
    print("Ошибка подключения")