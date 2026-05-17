const { performance } = require('perf_hooks');

function testOld(newLinks, existingRecordLinks) {
  const recordToSave = { links: [...existingRecordLinks] };
  for (const newLink of newLinks) {
    if (!recordToSave.links.find(l => l.url === newLink.url)) {
      recordToSave.links.push(newLink);
    }
  }
  return recordToSave.links;
}

function testNew(newLinks, existingRecordLinks) {
  const recordToSave = { links: [...existingRecordLinks] };
  const existingUrls = new Set(recordToSave.links.map(l => l.url));
  for (const newLink of newLinks) {
    if (!existingUrls.has(newLink.url)) {
      recordToSave.links.push(newLink);
      existingUrls.add(newLink.url);
    }
  }
  return recordToSave.links;
}

const numExisting = 10000;
const numNew = 5000;

const existingRecordLinks = [];
for (let i = 0; i < numExisting; i++) {
  existingRecordLinks.push({ url: `http://example.com/${i}` });
}

const newLinks = [];
for (let i = numExisting - 1000; i < numExisting + numNew - 1000; i++) {
  newLinks.push({ url: `http://example.com/${i}` });
}

const startOld = performance.now();
testOld(newLinks, existingRecordLinks);
const endOld = performance.now();

const startNew = performance.now();
testNew(newLinks, existingRecordLinks);
const endNew = performance.now();

console.log(`Old: ${endOld - startOld} ms`);
console.log(`New: ${endNew - startNew} ms`);
