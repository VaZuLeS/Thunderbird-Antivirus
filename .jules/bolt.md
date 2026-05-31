## 2026-05-31
* **Performance Improvement**: Replaced sequential `await` calls with `Promise.all` inside the attachments and links processing loop in `api.js`.
* **Impact**: External API calls for analysis reports (`get_hybrid_report_by_sha256`) were being fetched sequentially, leading to an O(N) waiting time. By fetching them concurrently, the overall wait time is reduced to ~O(1) relative to the number of attachments/links (bounded by the slowest request). Measurements show a ~5x speedup for 5 mocked requests (100ms vs 500ms).
