const root = document.querySelector("#view-root");

if (root) {
  root.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>今天</h2>
        <span class="hint">应用加载中</span>
      </div>
      <p class="empty">饮食记录将在这里显示。</p>
    </section>
  `;
}
