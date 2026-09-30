const d = 'google.com';
console.log('Single escape:', d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
console.log('Double escape:', d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'));

const regex1 = new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
console.log('Regex1 matches googleAcom?', regex1.test('googleAcom'));

const regex2 = new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'));
console.log('Regex2 matches googleAcom?', regex2.test('googleAcom'));
