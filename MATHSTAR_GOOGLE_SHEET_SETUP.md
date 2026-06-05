# MathStar to Google Sheet Setup

This connects MathStar attempts from Lucas's device into your Google Sheet tab named `lucas homework`.

## 1. Add the Apps Script receiver

1. Open your Google Sheet.
2. Choose `Extensions` -> `Apps Script`.
3. Paste the contents of `google-apps-script-lucas-homework.gs`.
4. Save the script.

## 2. Deploy it as a Web App

1. Click `Deploy` -> `New deployment`.
2. Choose type `Web app`.
3. Set `Execute as` to `Me`.
4. Set `Who has access` to `Anyone`.
5. Click `Deploy`, authorize it, and copy the Web App URL.

## 3. Connect Lucas's device

Open MathStar once on Lucas's device with this format:

```text
https://zhenyutao-web.github.io/MathStar/MathStar.html?sheetWebhook=PASTE_WEB_APP_URL_HERE&student=Lucas
```

The page saves the Web App URL in that browser, removes it from the address bar, and then sends every later attempt automatically.

If Lucas's device had already opened an older MathStar page before this change, open the URL above once, refresh the page once, then answer a question.

## 4. Quick check

After Lucas answers one question, open the Google Sheet tab `lucas homework`. You should see a new row with the timestamp, problem, answer, and result.
