// ベースマップ定義
const baseStyles = {
  carto: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
};

// 地図初期化
let map = new maplibregl.Map({
  container: 'map',
  style: baseStyles.carto,
  center: [139.9545, 35.8251], // 麗澤大学を中心に
  zoom: 1.2 // さらに引いたズーム（全ピンがより見やすくなります）
});
window.map = map;

// 地域アイコン
const regionIcon = {
  "North America": "R-blue.png",
  "Asia": "R-purple.png",
  "Europe": "R-blue2.png",
  "Oceania": "R-orenge.png",
  "Reitaku University": "R透過.png"
};

let allMarkers = [];
let universityList = [];

// ベースマップ切り替え機能を追加
document.getElementById('basemap-select').addEventListener('change', function(e) {
  const styleKey = e.target.value;
  map.setStyle(baseStyles[styleKey]);
  map.once('style.load', function() {
    showMarkersByRegion(getSelectedRegions());
  });
});

// CSVから大学リストを読み込む
fetch('大学ホームページ一覧_確定版.csv')
  .then(response => response.text())
  .then(csv => {
    universityList = csv.trim().split('\n').slice(1).map(line => {
      const [region, country, name, englishName, lat, lng, URL, language, Time] = line.split(',');
      return {
        region: region,
        country: country,
        name: name,
        "english name": englishName,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        URL: URL,
        language: language,
        Time: Time
      };
    });

    document.querySelectorAll('.region-checkbox').forEach(cb => cb.checked = true);
    showMarkersByRegion(getSelectedRegions());
  });

// 地域選択取得
function getSelectedRegions() {
  return Array.from(document.querySelectorAll('.region-checkbox:checked')).map(e => e.value);
}

// 言語フィルターの値取得
function getSelectedLanguages() {
  return Array.from(document.querySelectorAll('.language-checkbox:checked')).map(e => e.value);
}

// ピン表示
function showMarkersByRegion(selectedRegions, selectedLanguages) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];
  universityList.forEach(u => {
    let lang = u.language;
    if (!selectedRegions.includes(u.region)) return;
    if (selectedLanguages) {
      if (
        (selectedLanguages.includes('English') && lang.includes('英語')) ||
        (selectedLanguages.includes('German') && lang.includes('ドイツ語')) ||
        (selectedLanguages.includes('Chinese') && lang.includes('中国語')) ||
        (selectedLanguages.includes('Korean') && lang.includes('韓国語')) ||
        (selectedLanguages.includes('Other') && !['英語','ドイツ語','中国語','韓国語'].some(l=>lang.includes(l)))
      ) {
        // 表示
      } else {
        return;
      }
    }
    if (isNaN(u.lng) || isNaN(u.lat)) return;
    const el = document.createElement('img');
    el.src = regionIcon[u.region] || 'default.png';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.background = 'transparent';
    el.style.cursor = 'pointer';
    el.classList.add('univ-marker-img');
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([u.lng, u.lat])
      .addTo(map);
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      handleUnivPinClick(u, el);
    });
    allMarkers.push(marker);
  });
}

function handleUnivPinClick(u, el) {
  // --- 既存の飛行機・Time要素・軌跡を必ず消す ---
  const oldPlane = document.getElementById('fly-plane');
  if (oldPlane) oldPlane.remove();
  const oldMidPlane = document.getElementById('mid-plane');
  if (oldMidPlane) oldMidPlane.remove();
  const oldMidTime = document.getElementById('mid-time');
  if (oldMidTime) oldMidTime.remove();
  const oldPath = document.getElementById('fly-path');
  if (oldPath) oldPath.remove();

  // --- 飛行機アニメーション（麗澤大学以外のみ） ---
  if (u.region !== "Reitaku University") {
    let reitakuLngLat = [139.9545, 35.8251];
    let destLngLat = [u.lng, u.lat];

    // 北米の場合は太平洋を越えるように経路を調整
    let usePacificRoute = false;
    if (u.region === "North America" && Math.abs(reitakuLngLat[0] - destLngLat[0]) > 180) {
      usePacificRoute = true;
    }
    // 太平洋ルート判定（東経→西経 or 西経→東経で大きく離れている場合）
    if (u.region === "North America" && reitakuLngLat[0] > 100 && destLngLat[0] < -50) {
      usePacificRoute = true;
    }

    // 経度を調整して太平洋を越えるパスを作る
    let reitakuPoint = map.project(reitakuLngLat);
    let destPoint = map.project(destLngLat);

    // SVGで軌跡を描画
    let svg = document.getElementById('fly-path');
    if (svg) svg.remove();
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'fly-path');
    svg.style.position = 'fixed';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100vw';
    svg.style.height = '100vh';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = 3999;

    // パス生成
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#a6192e');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-opacity', '0.7');
    path.setAttribute('stroke-dasharray', '6,6');
    path.setAttribute('id', 'fly-path-line');

    // パスのd属性をセット
    function setPathD() {
      let rp = map.project(reitakuLngLat);
      let dp = map.project(destLngLat);

      if (usePacificRoute) {
        // 太平洋ルート：経度を+360して一周させる
        let pacificLngLat = [destLngLat[0] + 360, destLngLat[1]];
        let pacificPoint = map.project(pacificLngLat);

        // --- ここを修正：制御点を大きく上（北）に持ち上げる ---
        const curveStrength = 0.45; // ←値を大きくして上方向に
        // 中間点を大きく北に持ち上げる
        const cpx = (rp.x + pacificPoint.x) / 2;
        const cpy = (rp.y + pacificPoint.y) / 2 - 100; // -400pxで大きく上へ

        path.setAttribute('d', `M${rp.x},${rp.y} Q${cpx},${cpy} ${pacificPoint.x},${pacificPoint.y}`);
        svg.setAttribute('width', window.innerWidth);
        svg.setAttribute('height', window.innerHeight);
      } else {
        // 通常ルート
        const curveStrength = 0.18;
        const cpx = (rp.x + dp.x) / 2 - ((dp.y - rp.y) * curveStrength);
        const cpy = (rp.y + dp.y) / 2 + ((dp.x - rp.x) * curveStrength);
        path.setAttribute('d', `M${rp.x},${rp.y} Q${cpx},${cpy} ${dp.x},${dp.y}`);
        svg.setAttribute('width', window.innerWidth);
        svg.setAttribute('height', window.innerHeight);
      }
    }
    setPathD();
    svg.appendChild(path);
    document.body.appendChild(svg);

    // 飛行機画像
    const plane = document.createElement('img');
    plane.src = 'plane1.png';
    plane.id = 'fly-plane';
    plane.style.position = 'fixed';
    plane.style.width = '38px';
    plane.style.height = '38px';
    plane.style.left = `${reitakuPoint.x - 19}px`;
    plane.style.top = `${reitakuPoint.y - 19}px`;
    plane.style.zIndex = 4000;
    plane.style.pointerEvents = 'none';
    plane.style.transition = 'none';

    let filter = '';
    if (map.getStyle().sprite && map.getStyle().sprite.includes('dark-matter')) {
      filter = 'invert(1) drop-shadow(0 4px 12px #fff6)';
    } else if (
      map.getStyle().sources &&
      JSON.stringify(map.getStyle().sources).includes('dark-matter')
    ) {
      filter = 'invert(1) drop-shadow(0 4px 12px #fff6)';
    } else if (
      map.getStyle().name &&
      map.getStyle().name.toLowerCase().includes('dark')
    ) {
      filter = 'invert(1) drop-shadow(0 4px 12px #fff6)';
    }
    plane.style.filter = filter;

    const dx = destPoint.x - reitakuPoint.x;
    const dy = destPoint.y - reitakuPoint.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (u.region === "North America") {
      plane.style.transform = `rotate(${angle}deg) scaleY(-1)`;
    } else {
      plane.style.transform = `rotate(${angle}deg)`;
    }
    document.body.appendChild(plane);

    // ベジェ曲線関数
    function bezier(t, p0, p1, p2) {
      return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    }

    // 飛行機アニメーション
    const frames = 90;
    let frame = 0;
    function animatePlane() {
      frame++;
      const t = frame / frames;
      if (t > 1) {
        plane.remove();
        return;
      }
      let rp = map.project(reitakuLngLat);
      let dp = map.project(destLngLat);

      if (usePacificRoute) {
        // 太平洋ルート
        let pacificLngLat = [destLngLat[0] + 360, destLngLat[1]];
        let pacificPoint = map.project(pacificLngLat);

        // 軌跡と同じ制御点（上を大きく通る）
        const cpx = (rp.x + pacificPoint.x) / 2;
        const cpy = (rp.y + pacificPoint.y) / 2 - 100; // 軌跡と同じ値

        // ベジェ曲線で飛行機の位置を計算
        const x = bezier(t, rp.x, cpx, pacificPoint.x);
        const y = bezier(t, rp.y, cpy, pacificPoint.y);
        const scale = 1 + 0.3 * Math.sin(Math.PI * t);
        plane.style.left = `${x - 19}px`;
        plane.style.top = `${y - 19}px`;
        plane.style.filter = `${filter} drop-shadow(0 4px 12px #0006) opacity(${0.7 + 0.3 * (1 - Math.abs(0.5 - t) * 2)})`;
        if (u.region === "North America") {
          plane.style.transform = `rotate(${angle}deg) scaleY(-1) scale(${scale})`;
        } else {
          plane.style.transform = `rotate(${angle}deg) scale(${scale})`;
        }
      } else {
        // 通常ルート
        const curveStrength = 0.18;
        const cpx = (rp.x + dp.x) / 2 - ((dp.y - rp.y) * curveStrength);
        const cpy = (rp.y + dp.y) / 2 + ((dp.x - rp.x) * curveStrength);
        const x = bezier(t, rp.x, cpx, dp.x);
        const y = bezier(t, rp.y, cpy, dp.y);
        const scale = 1 + 0.3 * Math.sin(Math.PI * t);
        plane.style.left = `${x - 19}px`;
        plane.style.top = `${y - 19}px`;
        plane.style.filter = `${filter} drop-shadow(0 4px 12px #0006) opacity(${0.7 + 0.3 * (1 - Math.abs(0.5 - t) * 2)})`;
        if (u.region === "North America") {
          plane.style.transform = `rotate(${angle}deg) scaleY(-1) scale(${scale})`;
        } else {
          plane.style.transform = `rotate(${angle}deg) scale(${scale})`;
        }
      }
      requestAnimationFrame(animatePlane);
    }
    animatePlane();

    // 地図移動時に軌跡も再描画
    function updatePathAndMid() {
      setPathD();
      setMidPlanePosition();
    }
    map.on('move', updatePathAndMid);
    map.on('zoom', updatePathAndMid);

    // === ここから中間点に飛行機とTimeを表示 ===
    const midLng = (reitakuLngLat[0] + destLngLat[0]) / 2;
    const midLat = (reitakuLngLat[1] + destLngLat[1]) / 2;

    // 飛行機画像
    const midPlane = document.createElement('img');
    midPlane.src = 'plane1.png';
    midPlane.id = 'mid-plane';
    midPlane.style.position = 'fixed';
    midPlane.style.width = '38px';
    midPlane.style.height = '38px';
    midPlane.style.zIndex = 4100;
    midPlane.style.pointerEvents = 'none';

    // 黒いMAP（ダークマター）の時は画像を反転
    const style = map.getStyle();
    if (
      (style.sprite && style.sprite.includes('dark-matter')) ||
      (style.sources && JSON.stringify(style.sources).includes('dark-matter')) ||
      (style.name && style.name.toLowerCase().includes('dark'))
    ) {
      midPlane.style.filter = 'invert(1)';
    } else {
      midPlane.style.filter = '';
    }

    // Time表示
    const midTime = document.createElement('div');
    midTime.id = 'mid-time';
    midTime.textContent = u.Time ? `Flight Time: ${u.Time}` : '';
    midTime.style.position = 'fixed';
    midTime.style.color = '#a6192e';
    midTime.style.background = '#fff';
    midTime.style.fontSize = '15px';
    midTime.style.fontWeight = 'bold';
    midTime.style.padding = '2px 10px';
    midTime.style.borderRadius = '12px';
    midTime.style.boxShadow = '0 2px 8px #0002';
    midTime.style.zIndex = 4101;
    midTime.style.pointerEvents = 'none';
    midTime.style.whiteSpace = 'nowrap';

    function setMidPlanePosition() {
      let midX, midY;
      if (usePacificRoute) {
        // 太平洋ルートの場合、+360した座標で中間点を計算
        let rp = map.project(reitakuLngLat);
        let pacificLngLat = [destLngLat[0] + 360, destLngLat[1]];
        let pacificPoint = map.project(pacificLngLat);
        midX = (rp.x + pacificPoint.x) / 2;
        midY = (rp.y + pacificPoint.y) / 2;
      } else {
        // 通常ルート
        let rp = map.project(reitakuLngLat);
        let dp = map.project(destLngLat);
        midX = (rp.x + dp.x) / 2;
        midY = (rp.y + dp.y) / 2;
      }
      midPlane.style.left = `${midX - 19}px`;
      midPlane.style.top = `${midY - 19}px`;
      midTime.style.left = `${midX + 25}px`;
      midTime.style.top = `${midY - 10}px`;
    }
    setMidPlanePosition();
    document.body.appendChild(midPlane);
    document.body.appendChild(midTime);

    map.on('move', setMidPlanePosition);
    map.on('zoom', setMidPlanePosition);
  } else {
    const oldMidPlane = document.getElementById('mid-plane');
    if (oldMidPlane) oldMidPlane.remove();
    const oldMidTime = document.getElementById('mid-time');
    if (oldMidTime) oldMidTime.remove();
    const oldPath = document.getElementById('fly-path');
    if (oldPath) oldPath.remove();
  }

  document.querySelectorAll('.univ-marker-img').forEach(img => {
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.zIndex = '';
    img.style.filter = '';
  });
  if (el) {
    el.style.width = '56px';
    el.style.height = '56px';
    el.style.zIndex = '10';
    el.style.filter = (u.region === "Asia" || u.region === "Oceania")
      ? 'drop-shadow(0 0 6px #e91e63aa)'
      : 'drop-shadow(0 0 6px #1976d2aa)';
  }
  let infoDiv = document.getElementById('univ-info');
  if (!infoDiv) {
    infoDiv = document.createElement('div');
    infoDiv.id = 'univ-info';
    document.body.appendChild(infoDiv);
    setTimeout(() => {
      infoDiv.style.transform = 'translateX(0)';
    }, 10);
  } else {
    infoDiv.style.transform = 'translateX(0)';
  }
  infoDiv.innerHTML = `
    <div class="univ-info-content">
      <div class="univ-title">${u.name}</div>
      <div class="univ-ename">${u["english name"]||""}</div>
      <div class="univ-country">${u.country||""}</div>
      ${u.country ? `<div class="univ-flag"><img src="flags/${u.country.trim()}.png" alt="${u.country}"></div>` : ""}
      <div class="univ-lang">主に使われる言語：${u.language||"不明"}</div>
      ${u.URL && u.URL.trim() && (u.URL.trim().startsWith('http://') || u.URL.trim().startsWith('https://')) ?
        `<div class="univ-link">
          <a href="${u.URL.trim()}" target="_blank" rel="noopener noreferrer">ホームページはこちらから</a>
        </div>` : ""}
      <button id="zoom-to-univ" class="univ-btn">Zoom in</button>
    </div>
  `;

  const zoomBtn = document.getElementById('zoom-to-univ');
  if (zoomBtn) {
    zoomBtn.onclick = function() {
      map.flyTo({
        center: [u.lng, u.lat],
        zoom: 7,
        speed: 1.2
      });
      zoomBtn.textContent = 'Zoom out';
      zoomBtn.id = 'zoom-out-univ';
      zoomBtn.onclick = function() {
        // 最初のMAPの位置（麗澤大学中心・ズーム1.2）に戻す
        map.flyTo({
          center: [139.9545, 35.8251],
          zoom: 1.2,
          speed: 1.2
        });
        zoomBtn.textContent = 'Zoom in';
        zoomBtn.id = 'zoom-to-univ';
        zoomBtn.onclick = arguments.callee;
      };
    };
  }
}

// スプラッシュ非表示
window.addEventListener('DOMContentLoaded', function() {
  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('slide-hide');
  }, 1200);

  document.querySelectorAll('.region-checkbox').forEach(cb => cb.checked = true);
});

// 地域フィルターのチェックボックスにイベントを追加
document.querySelectorAll('.region-checkbox').forEach(cb => {
  cb.addEventListener('change', function() {
    showMarkersByRegion(getSelectedRegions());
  });
});

// --- フィルター全選択の制御を統一 ---

// 地域フィルター「全て」
document.getElementById('region-all').addEventListener('change', function(e) {
  const checked = e.target.checked;
  document.querySelectorAll('.region-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  showMarkersByRegion(getSelectedRegions(), getSelectedLanguages());
});

// 言語フィルター「全て」
document.getElementById('language-all').addEventListener('change', function(e) {
  const checked = e.target.checked;
  document.querySelectorAll('.language-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  showMarkersByRegion(getSelectedRegions(), getSelectedLanguages());
});

// 地域フィルター個別チェック時、「全て」の状態を自動制御
document.querySelectorAll('.region-checkbox').forEach(cb => {
  cb.addEventListener('change', function() {
    const all = document.getElementById('region-all');
    const boxes = document.querySelectorAll('.region-checkbox');
    all.checked = Array.from(boxes).every(b => b.checked);
    showMarkersByRegion(getSelectedRegions(), getSelectedLanguages());
  });
});

// 言語フィルター個別チェック時、「全て」の状態を自動制御
document.querySelectorAll('.language-checkbox').forEach(cb => {
  cb.addEventListener('change', function() {
    const all = document.getElementById('language-all');
    const boxes = document.querySelectorAll('.language-checkbox');
    all.checked = Array.from(boxes).every(b => b.checked);
    showMarkersByRegion(getSelectedRegions(), getSelectedLanguages());
  });
});

// --- フィルター開閉トグル機能を復活させる ---

document.querySelectorAll('.filter-toggle').forEach(btn => {
  btn.addEventListener('click', function() {
    const targetId = btn.getAttribute('data-target');
    const target = document.getElementById(targetId);
    if (target) {
      const isOpen = target.style.display !== 'none';
      target.style.display = isOpen ? 'none' : '';
      // ボタンの見た目も切り替え
      btn.textContent = isOpen ? '☐' : '☑';
    }
  });
});

// ページ読み込み時、フィルターを閉じた状態にする
window.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.filter-toggle').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const target = document.getElementById(targetId);
    if (target) {
      target.style.display = 'none';
      btn.textContent = '☐';
    }
  });

  // スプラッシュ非表示や初期チェックもここで
  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('slide-hide');
  }, 1200);

  document.querySelectorAll('.region-checkbox').forEach(cb => cb.checked = true);
});

// 初期表示時
showMarkersByRegion(getSelectedRegions(), getSelectedLanguages());