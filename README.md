# 12-bar blues overlay

Готовая вертикальная инфографика одного 12-тактового квадрата: **115 BPM**, 4/4, 1080×1920, 60 fps. Canvas всегда очищается до прозрачности; состояние тактов и метронома вычисляется из абсолютного времени.

## Экспорт

Требуются Node.js 22, FFmpeg/FFprobe и Playwright Chromium.

```bash
npm ci
npx playwright install chromium
npm run export
npm run verify
```

Или откройте вкладку **Actions**, выберите workflow **Render 12-bar blues overlay**, нажмите **Run workflow**, а после успешного завершения скачайте артефакт `12-bar-blues-115bpm-render` со страницы запуска.

Экспорт создаёт в `dist/` ProRes 4444 MOV с `yuva444p10le`, VP9 WebM с alpha metadata, MP4-превью на фоне `#11151b`, контрольные PNG `control-bar-01-start.png`, `control-bar-05-mid.png`, `control-bar-09-turnaround.png` и два JSON-отчёта. Первые два видео и PNG прозрачны. Ближайшее не обрезающее музыку целое число кадров для 115 BPM — 1503, поэтому контейнер длится 25.050000 с (музыкальная длительность 25.0434782609 с; отклонение составляет 0.0065217391 с). Все границы тактов вычисляются из абсолютных значений `bar * 240 / BPM`, без накопления округлений.

## Изменение BPM

Измените `bpm` в `animation.js`, затем передайте то же значение экспортёру:

```bash
BPM=120 npm run export
BPM=120 npm run verify
```

Форма задаётся массивом `FORM`, цвета — объектом `COLORS` в `animation.js`. Для браузерного просмотра запустите `npm run preview` и откройте `http://localhost:8000`.
