const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <form id="settingsForm">
    <input type="password" id="apikey" required>
    <button id="save" type="submit">Speichern</button>
  </form>
  <script>
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Form submitted!');
    });
  </script>
</body>
</html>
`, { runScripts: "dangerously" });

const input = dom.window.document.getElementById('apikey');
const btn = dom.window.document.getElementById('save');

console.log('Clicking with empty input...');
btn.click(); // Should not submit because required

input.value = 'test';
console.log('Clicking with valid input...');
btn.click(); // Should submit
