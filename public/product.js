const cart = JSON.parse(localStorage.getItem("oranjCart") || "[]");
const detailEl = document.getElementById("productDetail");
const quickCartBtn = document.getElementById("quickCartBtn");
const quickCartCount = document.getElementById("quickCartCount");
const quickCartPanel = document.getElementById("quickCartPanel");
const toastEl = document.getElementById("toast");

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2400);
}

function formatTl(value) {
  return `${Number(value).toFixed(2)} TL`;
}

function getOldPrice(product) {
  return Number(product.oldPrice ?? product.price);
}

function getCurrentPrice(product) {
  const oldPrice = getOldPrice(product);
  const discount = product.discountPrice === null || product.discountPrice === undefined
    ? null
    : Number(product.discountPrice);
  if (discount && discount > 0 && discount < oldPrice) return discount;
  return Number(product.price);
}

function getDiscountPercent(product) {
  const oldPrice = getOldPrice(product);
  const current = getCurrentPrice(product);
  if (current >= oldPrice) return 0;
  return Math.round(((oldPrice - current) / oldPrice) * 100);
}

function hairDyeImage(product) {
  const code = product.variants?.[0]?.code || "0.0";
  const palette = {
    "1.0": "#1f1512",
    "2.0": "#2f1e18",
    "3.0": "#4a2d21",
    "4.0": "#5b3a2b",
    "5.0": "#704631",
    "6.0": "#8a5a3f",
    "7.0": "#a46d47",
    "8.0": "#c28a58",
    "9.0": "#deb67f",
    "10.0": "#f1d6a5"
  };
  const dyeColor = palette[code] || "#7a4b38";
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='700' height='500' viewBox='0 0 700 500'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#ffe9f5'/>
        <stop offset='100%' stop-color='#ffd1e8'/>
      </linearGradient>
      <linearGradient id='box' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stop-color='${dyeColor}'/>
        <stop offset='100%' stop-color='#1a1a1a'/>
      </linearGradient>
    </defs>
    <rect width='700' height='500' fill='url(#bg)'/>
    <rect x='210' y='60' width='280' height='380' rx='18' fill='url(#box)' stroke='#ffffff' stroke-width='4'/>
    <text x='350' y='225' text-anchor='middle' fill='#ffffff' font-size='44' font-family='Arial' font-weight='700'>SAÇ BOYASI</text>
    <text x='350' y='280' text-anchor='middle' fill='#ffd9eb' font-size='30' font-family='Arial'>KOD ${code}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function persistCart() {
  localStorage.setItem("oranjCart", JSON.stringify(cart));
}

function renderQuickCart(products = []) {
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  quickCartCount.textContent = String(count);
  if (!cart.length) {
    quickCartPanel.innerHTML = "<p>Sepetiniz boş.</p>";
    return;
  }
  const lines = cart
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return `<div class="item"><strong>${product?.name || line.productId}</strong><br/>Adet: ${line.quantity}
        <button class="btn danger" data-quick-remove="${line.productId}" style="margin-top:6px;">Çıkar</button>
      </div>`;
    })
    .join("");
  quickCartPanel.innerHTML = `
    ${lines}
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <a class="btn" href="index.html?tab=cart">Sepete Git</a>
      <button class="btn danger" id="quickClearCartBtn">Sepeti Sıfırla</button>
    </div>
  `;

  document.querySelectorAll("[data-quick-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = cart.findIndex((item) => item.productId === btn.dataset.quickRemove);
      if (idx >= 0) cart.splice(idx, 1);
      persistCart();
      renderQuickCart(products);
      toast("Ürün mini sepetten çıkarıldı.");
    });
  });

  const quickClearCartBtn = document.getElementById("quickClearCartBtn");
  if (quickClearCartBtn) {
    quickClearCartBtn.addEventListener("click", () => {
      cart.length = 0;
      persistCart();
      renderQuickCart(products);
      toast("Sepet sıfırlandı.");
    });
  }
}

function addToCart(product, quantity) {
  const existing = cart.find((item) => item.productId === product.id);
  if (existing) existing.quantity += quantity;
  else cart.push({ productId: product.id, quantity });
  persistCart();
}

async function loadPage() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      detailEl.innerHTML = "<p>Ürün seçimi bulunamadı.</p>";
      return;
    }

    const [detailRes, contentRes] = await Promise.all([
      fetch(`/api/customer/products/${encodeURIComponent(id)}`),
      fetch("/api/customer/content")
    ]);

    if (!detailRes.ok) {
      detailEl.innerHTML = "<p>Ürün bulunamadı.</p>";
      return;
    }

    const { product } = await detailRes.json();
    const content = await contentRes.json();
    const oldPrice = getOldPrice(product);
    const currentPrice = getCurrentPrice(product);
    const percent = getDiscountPercent(product);
    const maxQty = Math.min(24, Math.max(1, Number(product.stock) || 1));
    renderQuickCart(content.products);

    detailEl.innerHTML = `
      <div class="product-detail">
        <img src="${hairDyeImage(product)}" alt="${product.name}" />
        <div>
          <h2>${product.name}</h2>
          <p>${product.description}</p>
          <p><strong>Stok:</strong> ${product.stock}</p>
          <p><strong>Varyant / Boya No:</strong> ${product.variants?.[0]?.code || "-"}</p>
          <p>
            <span class="old-price">${formatTl(oldPrice)}</span>
            <span class="new-price">${formatTl(currentPrice)}</span>
            ${percent > 0 ? `<span class="discount-badge">%${percent} İndirim</span>` : ""}
          </p>
          <div class="qty-line">
            <label for="qtyInput"><strong>Adet:</strong></label>
            <input id="qtyInput" type="number" min="1" max="${maxQty}" value="1" />
            <button id="addMultiBtn" class="btn">Sepete Ekle</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("addMultiBtn").addEventListener("click", () => {
      const qty = Number(document.getElementById("qtyInput").value || 1);
      if (qty < 1) return toast("Adet en az 1 olmalı.");
      if (qty > maxQty) return toast(`En fazla ${maxQty} adet ekleyebilirsiniz.`);
      addToCart(product, qty);
      renderQuickCart(content.products);
      toast("Ürün sepete eklendi.");
    });
  } catch (_) {
    detailEl.innerHTML = "<p>Ürün sayfası yüklenemedi. Sayfayı yenileyin.</p>";
  }
}

quickCartBtn.addEventListener("click", () => quickCartPanel.classList.toggle("hidden"));
loadPage();
