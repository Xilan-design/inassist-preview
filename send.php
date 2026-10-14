<?php
/* Приём заявок с сайта ИнАссист.

   Формы на сайте отправляют сюда имя, телефон, тему и сообщение. Скрипт проверяет поля,
   отбрасывает спам-ботов и присылает заявку на почту и — если заполнены настройки ниже — в Telegram.
   Отвечает JSON: {"ok":true} или {"ok":false,"error":"..."}; сайт показывает «Заявка отправлена»
   или просит перезвонить.

   Нужен хостинг с PHP 7.4+ и работающей отправкой почты (функция mail()). Если письма не доходят,
   спросите хостинг, как настроить почту, или подключите Telegram — он работает без почтового сервера. */

// ---------- Настройки ----------
$MAIL_TO   = 'info@inassist.by';            // куда присылать заявки; несколько адресов — через запятую
$MAIL_FROM = 'no-reply@inassist.by';        // от чьего имени письмо; домен должен совпадать с доменом сайта
$TELEGRAM_BOT_TOKEN = '';                   // токен бота от @BotFather, например 123456:ABC-DEF…
$TELEGRAM_CHAT_ID   = '';                   // id чата или группы, куда бот присылает заявки
// --------------------------------

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply($ok, $error = '', $code = 200) {
    http_response_code($code);
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function field($name, $max) {
    $value = isset($_POST[$name]) ? (string) $_POST[$name] : '';
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    if ($value === null) return '';   // битая кодировка — считаем поле пустым
    return mb_substr(trim($value), 0, $max, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'method', 405);

// Ловушка: скрытое поле website заполняют только боты. Отвечаем «успешно», чтобы бот не пробовал снова
if (field('website', 200) !== '') reply(true);

$name    = field('name', 100);
$phone   = field('phone', 40);
$topic   = field('topic', 60);
$message = field('message', 2000);
$page    = field('page', 300);
$consent = isset($_POST['consent']);

$digits = preg_replace('/\D/', '', $phone);
if ($name === '' || strlen($digits) < 9 || strlen($digits) > 15 || !$consent) reply(false, 'invalid', 422);

// ---------- Текст заявки ----------
$lines = [
    'Имя: ' . $name,
    'Телефон: ' . $phone,
];
if ($topic !== '')   $lines[] = 'Что нужно: ' . $topic;
if ($message !== '') $lines[] = "Сообщение:\n" . $message;
if ($page !== '')    $lines[] = 'Страница: ' . $page;
$lines[] = 'Время: ' . date('d.m.Y H:i');
$text = implode("\n", $lines);

$sent = false;

// ---------- Почта ----------
if ($MAIL_TO !== '') {
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . $name) . '?=';
    $headers = implode("\r\n", [
        'From: =?UTF-8?B?' . base64_encode('Сайт ИнАссист') . '?= <' . $MAIL_FROM . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]);
    $sent = @mail($MAIL_TO, $subject, $text, $headers) || $sent;
}

// ---------- Telegram ----------
if ($TELEGRAM_BOT_TOKEN !== '' && $TELEGRAM_CHAT_ID !== '') {
    $context = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query(['chat_id' => $TELEGRAM_CHAT_ID, 'text' => "Заявка с сайта\n\n" . $text]),
        'timeout' => 10,
    ]]);
    $result = @file_get_contents('https://api.telegram.org/bot' . $TELEGRAM_BOT_TOKEN . '/sendMessage', false, $context);
    $sent = ($result !== false && strpos($result, '"ok":true') !== false) || $sent;
}

$sent ? reply(true) : reply(false, 'send', 500);
