const container = document.getElementById("urunDetayContainer");
const toastEl = document.getElementById("toast");

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function formatTl(value) {
  return `${Number(value).toFixed(2)} TL`;
}

function getCurrentPrice(product) {
  const oldPrice = Number(product.oldPrice ?? product.price);
  const discount = product.discountPrice === null || product.discountPrice === undefined
    ? null
    : Number(product.discountPrice);
  if (discount && discount > 0 && discount < oldPrice) return discount;
  return Number(product.price);
}

function getDiscountPercent(product) {
  const oldPrice = Number(product.oldPrice ?? product.price);
  const current = getCurrentPrice(product);
  if (current >= oldPrice) return 0;
  return Math.round(((oldPrice - current) / oldPrice) * 100);
}

function addToCart(product, qty) {
  const cart = JSON.parse(localStorage.getItem("oranjCart") || "[]");
  const existing = cart.find((item) => item.productId === product.id);
  if (existing) existing.quantity += qty;
  else cart.push({ productId: product.id, quantity: qty });
  localStorage.setItem("oranjCart", JSON.stringify(cart));
}

async function init() {
  try {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      container.innerHTML = "<p>Ürün kimliği bulunamadı.</p>";
      return;
    }

    const contentRes = await fetch("/api/customer/content");
    if (!contentRes.ok) {
      container.innerHTML = "<p>Ürün verisi alınamadı.</p>";
      return;
    }
    const content = await contentRes.json();
    const product = content.products.find((p) => p.id === id);
    if (!product) {
      container.innerHTML = "<p>Ürün bulunamadı.</p>";
      return;
    }

    const code = product.variants?.[0]?.code || "-";
    const oldPrice = Number(product.oldPrice ?? product.price);
    const currentPrice = getCurrentPrice(product);
    const discount = getDiscountPercent(product);
    const maxQty = Math.min(24, Math.max(1, Number(product.stock) || 1));

    container.innerHTML = `
      <div class="item">
        <h2>${product.name}</h2>
        <p><strong>Ürün Kodu:</strong> ${product.id}</p>
        <p><strong>Boya Kodu:</strong> ${code}</p>
        <p><strong>Kategori:</strong> ${product.categoryId}</p>
        <p><strong>Stok Adedi:</strong> ${product.stock}</p>
        <p><strong>Açıklama:</strong> ${product.description}</p>
        <p>
          <strong>Fiyat:</strong>
          <span class="old-price">${formatTl(oldPrice)}</span>
          <span class="new-price">${formatTl(currentPrice)}</span>
          ${discount > 0 ? `<span class="discount-badge">%${discount} indirim</span>` : ""}
        </p>
        <p><strong>Özellikler:</strong> Kalıcı renk, parlak görünüm, profesyonel kullanım.</p>
        <div class="qty-line">
          <label for="urunDetayQty"><strong>Adet:</strong></label>
          <input id="urunDetayQty" type="number" min="1" max="${maxQty}" value="1" />
          <button id="urunDetayAddBtn" class="btn">Sepete Ekle</button>
        </div>
      </div>
    `;

    document.getElementById("urunDetayAddBtn").addEventListener("click", () => {
      const qty = Number(document.getElementById("urunDetayQty").value || 1);
      if (qty < 1) return toast("Adet en az 1 olmalı.");
      if (qty > maxQty) return toast(`En fazla ${maxQty} adet eklenebilir.`);
      addToCart(product, qty);
      toast(`${qty} adet sepete eklendi.`);
    });
  } catch (_) {
    container.innerHTML = "<p>Ürün sayfası yüklenirken hata oluştu.</p>";
  }
}

init();
