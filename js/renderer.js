// js/renderer.js - Three.js 3D 渲染與互動

class ChessRenderer {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.boardMesh = null;
        this.pieceMeshes = {}; // 'row,col' => mesh
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.onPieceClick = null; // 回呼函數

        /* 🎥 開場視角(重置視角會放回這裡)。只寫這一份,兩邊都讀它。 */
        this.INITIAL_CAM = { x: 0, y: -60, z: 90 };

        /* 🎨 配色來源(2026-09-09,**已更正**):使用者指定「3chinese.netlify.app 的綠底棋子與
             米白底棋盤做得很漂亮,請參考」。
           ★★ 我一開始判錯,記下來免得下一手再錯:我看它的工具列(難度/開局譜/2D/存檔讀檔/安裝/
              重置視角)和本站幾乎一樣,就推論「它是本站 v1 之前那個沒有原始碼的前身」——**錯的**。
              使用者反問「為何之後要改配色?我認為不是前身」,查下去才對:
              它是**第三個**中國象棋站 `3d-chinese-chess`(React + Vite,**有完整原始碼**),
              還活著,線上三個網址:3dchinese / 3d-chinese-chess / 3dchinesechess .pages.dev。
              `3chinese.netlify.app` 只是它搬到 CF Pages 之前的舊 Netlify 網址(現在 404)。
              ⇒ 小面積的色(棋子的字、選中色)直接抄它的原始碼精確值:
                `src/components/Piece.jsx`(棋子面/綠邊/紅字/黑字)、`src/components/Board.jsx`
                (盤面 #ebc38a、格線 #594433)、`src/App.jsx`(背景 #2c3e50)。
              ⚠⚠ **但盤面與棋子綠不能照抄色碼**,也不能靠目測 —— 見下面 PALETTE 那段:
                0909 使用者第二次退件(「棋盤較橘 / 底部深綠且只有一層」)查出真因是**曝光爆掉**,
                修法是先修光預算、再用「渲出來的像素」對齊參考站的實測值。
           ★ 參考站的「選中/被提示的棋子」是**橘色** `#f4a261` 頂面 + 深綠 `#2e7d32` 邊 ——
             0909 使用者拍板「這個很好,要學起來」,本站已照抄(見 setSelectedPiece);
             綠圈與綠點同時保留,它們指的是「要走到哪」,和「是哪一顆」是兩件事。
           改之前(整片偏黃褐、和背景糊在一起):棋盤 0xd2b48c、格線 0x000000、
             棋子頂 #f0d9b5 + 棕圈、棋子側 0xe0c090、紅字 #ff0000、黑字 #000000、背景 0x333333。 */
        this.PALETTE = {
            bg: 0x2c3e50,          // 背景:深板岩藍(App.jsx 的 <color background>)
            /* 🎨 盤面與棋子綠 ⚠⚠ 這些值是**用實測像素反推**的,不是照抄色碼、也不是目測截圖。
               ★★ 2026-09-09 使用者退件:「3d-chinese-chess 的棋盤較橘,另兩支很白;
                  參考站棋子有兩層(上白、下層底部螢光綠),另兩支底部深綠且只有一層」。
               ★★ 取使用者手機截圖的像素比對(河界空白帶 / 棋子側面各取一片,量中位與眾數):
                    · 盤面   參考站 rgb(232,224,208) 暖米 ↔ 本站 rgb(248,248,248) **近全白**
                    · 棋子綠 參考站 rgb(88,176,88) 亮綠  ↔ 本站 rgb(40,104,40) **深綠**
               ★★ 病因**不是色碼寫錯,是曝光爆掉**(算式逐位對得上,不是猜的):
                    · 盤面朝上(n=+Z)吃 環境光 0.6 + 平行光 0.8×0.808 = **1.246 倍**
                      ⇒ 舊值 0xece0c0 (236,224,192) × 1.246 = (294,279,239)
                      ⇒ 紅綠兩個 channel **直接裁到 255** ⇒ 暖色被裁掉,看起來就是白的。
                    · 圓柱側面法線水平 ⇒ 對主光 n·l ≤ 0 ⇒ **只吃到環境光 0.6**
                      ⇒ 0x4caf50 (76,175,80) × 0.6 = (46,105,48) ≈ 實測 (40,104,40)。
               ⇒ 所以先修**光預算**(見下面 Lights 段:環境 0.55 + 主光 0.50 + 跟相機方位的低角度
                 補光 0.45 ⇒ 朝上面 ≈ 0.99 倍不再裁切、側面 ≈ 1.0 倍不再只剩環境光),
                 材質色碼才有意義;修好之後這兩個值就幾乎等於參考站的**渲出像素**。
               ⚠ 舊註解寫「照抄 0xebc38a 會偏黃 ⇒ 以目測觀感為準」——**方向對、結論錯**:
                 偏黃正是 1.246 倍裁切造成的,不是材質差異造成的。目測換來的 0xece0c0
                 在爆光下一樣是白的。⇒ 通則:**大面積色與「只吃得到環境光的面」一定要量渲出來的像素**,
                 比 material 色碼(甚至目測截圖)都會得出錯的結論。 */
            boardTop: 0xe0d8c9,    // 盤面 → 渲出來 ≈ rgb(232,224,208) = 參考站實測值(量測反推,別手改)
            boardSide: 0xcec6b3,   // 盤側(厚度)比盤面深一階(參考站是平面盤,沒有側面色)
            gridLine: 0x594433,    // 格線:深咖啡(Board.jsx lineColor)—— 不是黑
            pieceSide: 0x58b058,   // ★ 棋子綠底座 → 渲出來 ≈ rgb(88,176,88) = 參考站實測值
            pieceUpper: 0xfdfaf6,  // ★ 棋子**上層**圓柱的側面:象牙白(參考站是雙層,上白下綠)
            pieceFace: '#fdfaf6',  // 棋子頂面:象牙白(Piece.jsx 上半圓柱)
            pieceRing: '#cfc7b5',  // 頂面那兩圈:柔和的灰 ★ 本站自有,參考站的字是 3D Text、沒有圈
            redInk: '#e63946',     // 紅方的字(Piece.jsx)
            blackInk: '#1d3557',   // 黑方的字:深藍(Piece.jsx)—— 不是黑
            selFace: 0xf4a261,     // 🟠 被選中/被提示那顆的頂面(Piece.jsx selectedColor)
            selRim: 0x2e7d32,      // 🟠 被選中那顆的綠邊轉深綠(Piece.jsx)
        };

        // 常數設定
        this.SQUARE_SIZE_X = 10;
        this.SQUARE_SIZE_Y = 8.5; // 讓棋盤長度(Y軸)短一點，符合視覺比例
        this.BOARD_WIDTH = 9 * this.SQUARE_SIZE_X;
        this.BOARD_HEIGHT = 10 * this.SQUARE_SIZE_Y;
        this.BOARD_THICKNESS = 4;
        this.PIECE_RADIUS = 4;
        /* 棋子厚度。★ 2026-09-09 從 2 調到 3:改成「上白下綠」雙層之後,
           每一層只有 1 單位高,綠底座在 8 單位直徑的盤上細得像一條線。
           參考站 3d-chinese-chess 的比例是 高:徑 = 0.30:0.84 ≈ 0.36,本站 2:8 = 0.25
           ⇒ 取 3(3:8 = 0.375)最接近它,綠色帶的厚度才讀得出來。
           ⚠ 這個值同時是棋子的 z 定位(PIECE_HEIGHT/2 + 0.1 = 貼在盤面上)與
             提示標記的高度基準 ⇒ 改它會一起跟著縮放,不要另外寫死數字。 */
        this.PIECE_HEIGHT = 3;
        
        this.highlightMeshes = [];
        this.animationId = null;
        
        // 動畫相關狀態
        this.animatingPieces = []; // { mesh, targetPos, startTime, duration }
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        // 支援滑鼠與觸控點擊
        this.container.addEventListener('pointerdown', this.onMouseClick.bind(this), false);
    }
    
    initScene(initialBoardState) {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.PALETTE.bg);
        
        // 2. Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        /* 開場視角。★ 座標只寫一份(this.INITIAL_CAM)是為了「🎥 重置視角」放回**同一個**位置
           —— 抄第二份的那天兩邊就會漂(俯角 atan(90/60) ≈ 56°,和對局場同一個角度)。 */
        this.camera.position.set(this.INITIAL_CAM.x, this.INITIAL_CAM.y, this.INITIAL_CAM.z);
        this.camera.lookAt(0, 0, 0);
        
        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        /* 🔍 `setPixelRatio` 不設的話 three 用 1 ⇒ 手機 devicePixelRatio=3 時
             WebGL 只畫 1/3 解析度,再被瀏覽器放大到 CSS 尺寸 ⇒ **整個畫面**(棋子的字最明顯)
             都是糊的。2026-09-09 使用者退件「字體模糊不清」的主因;姊妹站 xiangqi-arena
             一直都有這一行,本站漏了。
           ⚠ 夾在 2:dpr=3 的手機全解析度要畫 9 倍像素,3D 場景會掉幀(糊的反面是卡的)。
           ⚠ resize 時要**再設一次**(見 onWindowResize):把視窗拖到不同 dpi 的螢幕、
             或瀏覽器縮放改變時 devicePixelRatio 會變,只改 setSize 的話又糊回去。 */
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);
        
        // 4. Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        /* 🖐 觸控裝置把靈敏度降下來(2026-09-09 使用者實機退件:「手機版棋盤旋轉太快、太靈敏」;
             姊妹站 xiangqi-arena 同一天同一條)。
           OrbitControls 的旋轉量 = 2π × 拖曳像素 ÷ **容器高** × rotateSpeed(兩軸都除容器高)
           ⇒ 速度 1.0 時直向手機(844 高)一根手指劃 150px 就轉 **64°**,手指一滑棋盤就飛走。
           ⇒ 觸控 0.4(同樣 150px ≈ 26°,對局場實測 25°)、平移 0.5;滑鼠維持 1.0
             (桌機是按著拖曳看、有滑鼠精度,一起調慢會變成拖很多下才轉得動)。 */
        const coarsePointer = typeof window.matchMedia === 'function'
            && window.matchMedia('(pointer: coarse)').matches;
        this.controls.rotateSpeed = coarsePointer ? 0.4 : 1.0;
        this.controls.panSpeed = coarsePointer ? 0.5 : 1.0;
        // 允許玩家水平 360 度任意旋轉觀看棋盤
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        // 放寬垂直視角限制，讓玩家可以從正上方甚至稍微從底部觀看
        this.controls.maxPolarAngle = Math.PI; // 允許轉到棋盤正下方
        this.controls.minPolarAngle = 0; // 允許轉到正上方純 2D 視角
        
        /* ★ 相機距離照畫布長寬比算(見 fitCamera)。一定要在 controls 之後叫 ——
             fitCamera 會去設 controls.target,順序反過來那一段會靜靜跳過。 */
        this.fitCamera();

        /* 5. Lights ⚠⚠ 這三顆的強度是**光預算**,不是隨手調的觀感值(2026-09-09 重算)。
             舊配置 環境 0.6 + 主光 0.8 讓朝上的盤面吃到 0.6 + 0.8×0.808 = **1.246 倍**
             ⇒ 任何暖色的 R/G channel 都被裁到 255 ⇒ 盤面永遠是白的,調色碼調不回來。
             而圓柱側面對主光 n·l ≤ 0 ⇒ 只吃環境光 0.6 ⇒ 綠底座永遠是深綠。
             新配置(兩個面都落在 ~1.0 倍,不裁切也不欠光):
               · 朝上(n=+Z):0.55 + 0.50×0.808 + 0.45×0.083 = **0.991**
               · 面向相機的側面:0.55 + 0.45×0.997 = **0.998**
             ⇒ PALETTE 的色碼從此可以直接對著「參考站的渲出像素」設。
             ★ 補光刻意壓在**低仰角**(z=10 對水平 120):仰角高的話從正上方看盤面
               會再吃到 0.45 倍 ⇒ 又爆掉。方位角則跟著相機轉(見 animate),
               否則轉到另一側時側面又只剩環境光、綠色又變深。 */
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.50);
        dirLight.position.set(50, 50, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // 側面補光:方位跟著相機(animate 裡更新)、仰角固定很低、不投影(投影是主光的事)
        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
        this.fillLight.position.set(0, -120, 10);
        this.scene.add(this.fillLight);
        
        // 6. Build Board
        this.createBoard();
        
        // 7. Place Pieces
        this.updateBoardState(initialBoardState);
    }
    
    /* 📐 相機距離要**照畫布長寬比算**,不可以寫死(2026-09-09 補)。
       ★★ 0909 實機截圖抓到的真 bug:這一站的相機從一開始就寫死在 (0,-60,90),
          只有 onWindowResize 改 aspect、距離永遠不動。桌機寬螢幕剛好裝得下,
          但手機**直向**(390×844,aspect 0.46)水平視角只剩約 19° ⇒
          在那個距離看得到的寬度約 36 單位,而棋盤有 90 單位寬
          ⇒ 棋盤爆出畫面兩三倍,只看得到中間幾格。
          (manifest 鎖 landscape,所以「裝成 App」時剛好躲過;用瀏覽器直向開就中了。)
          這也讓「旋轉太靈敏」更嚴重 —— 棋盤大到看不到全貌時,轉一點就天翻地覆。
       ⇒ 算法照抄姊妹站 xiangqi-arena 的 fitCamera(它 0902 重建時就修掉了這個病):
         用 fov 與 aspect 反推「要退多遠才裝得下」,寬與高各算一次取大的。
       ★ 只改**距離**,不改俯角:方向沿用 INITIAL_CAM 的 (0,-60,90) ⇒ 俯角維持 atan(90/60) ≈ 56°。 */
    fitCamera() {
        if (!this.camera) return;
        const w = window.innerWidth, h = window.innerHeight;
        if (!w || !h) return;
        const aspect = w / h;
        const halfFov = (this.camera.fov * Math.PI) / 180 / 2;
        // 棋盤外圍留半格邊:留太多是一片空白,留太少棋子貼著邊緣(平板上手指還會蓋掉)
        const boardW = this.BOARD_WIDTH + this.SQUARE_SIZE_X * 0.5;
        const boardH = this.BOARD_HEIGHT + this.SQUARE_SIZE_Y * 0.5;
        const distForH = (boardH / 2) / Math.tan(halfFov);
        const distForW = (boardW / 2) / Math.tan(halfFov) / aspect;
        // 1.06:斜看的投影比正上方矮,但四個角要留一點餘裕(對局場量出來的值)
        const dist = Math.max(distForH, distForW) * 1.02 * 1.06;
        const len = Math.hypot(this.INITIAL_CAM.y, this.INITIAL_CAM.z) || 1;
        this.camera.position.set(
            0,
            dist * (this.INITIAL_CAM.y / len),
            dist * (this.INITIAL_CAM.z / len),
        );
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    /* 🎥 重置視角(2026-09-09 使用者要求:「再加上重置視角小按鈕」)。
       ⚠ 一定要連 controls.target 一起歸零 —— 兩指平移會把 target 拖走,
         只搬 camera.position 的話會變成「從新位置看著被拖歪的中心」,比原本更亂。
       ⚠ 也要清掉阻尼還沒吃完的殘量(再 update 一次),不然放手後它會繼續飄一小段。 */
    resetCamera() {
        this.fitCamera();
        if (this.controls) this.controls.update();
    }

    createBoard() {
        // 棋盤本體 (木頭顏色)
        const boardGeo = new THREE.BoxGeometry(this.BOARD_WIDTH, this.BOARD_HEIGHT, this.BOARD_THICKNESS);
        /* BoxGeometry 的材質順序是 [+X, -X, +Y, -Y, +Z, -Z];這塊板的厚度在 Z
           ⇒ index 4(+Z)是棋盤面,其餘是側面與底面。 */
        const sideMat = new THREE.MeshPhongMaterial({ color: this.PALETTE.boardSide });
        const boardMat = [
            sideMat, sideMat, sideMat, sideMat,
            new THREE.MeshPhongMaterial({ color: this.PALETTE.boardTop }),   // +Z = 棋盤面
            sideMat,
        ];
        this.boardMesh = new THREE.Mesh(boardGeo, boardMat);
        this.boardMesh.receiveShadow = true;
        // 把棋盤表面放在 z=0 平面
        this.boardMesh.position.z = -this.BOARD_THICKNESS / 2;
        this.scene.add(this.boardMesh);
        
        // 繪製棋盤線條 (簡單的線段)
        const lineMaterial = new THREE.LineBasicMaterial({ color: this.PALETTE.gridLine });
        const startX = -this.BOARD_WIDTH / 2 + this.SQUARE_SIZE_X / 2;
        const startY = -this.BOARD_HEIGHT / 2 + this.SQUARE_SIZE_Y / 2;
        
        // 橫線
        for (let i = 0; i < 10; i++) {
            const points = [];
            points.push(new THREE.Vector3(startX, startY + i * this.SQUARE_SIZE_Y, 0.1));
            points.push(new THREE.Vector3(startX + 8 * this.SQUARE_SIZE_X, startY + i * this.SQUARE_SIZE_Y, 0.1));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.scene.add(line);
        }
        
        // 直線
        for (let j = 0; j < 9; j++) {
            const x = startX + j * this.SQUARE_SIZE_X;
            // 上半部
            const pointsTop = [];
            pointsTop.push(new THREE.Vector3(x, startY + 5 * this.SQUARE_SIZE_Y, 0.1));
            pointsTop.push(new THREE.Vector3(x, startY + 9 * this.SQUARE_SIZE_Y, 0.1));
            const geoTop = new THREE.BufferGeometry().setFromPoints(pointsTop);
            this.scene.add(new THREE.Line(geoTop, lineMaterial));
            
            // 下半部
            const pointsBot = [];
            pointsBot.push(new THREE.Vector3(x, startY, 0.1));
            pointsBot.push(new THREE.Vector3(x, startY + 4 * this.SQUARE_SIZE_Y, 0.1));
            const geoBot = new THREE.BufferGeometry().setFromPoints(pointsBot);
            this.scene.add(new THREE.Line(geoBot, lineMaterial));
        }
        // 楚河漢界邊緣線
        const pointsMidL = [];
        pointsMidL.push(new THREE.Vector3(startX, startY + 4 * this.SQUARE_SIZE_Y, 0.1));
        pointsMidL.push(new THREE.Vector3(startX, startY + 5 * this.SQUARE_SIZE_Y, 0.1));
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsMidL), lineMaterial));

        const pointsMidR = [];
        pointsMidR.push(new THREE.Vector3(startX + 8 * this.SQUARE_SIZE_X, startY + 4 * this.SQUARE_SIZE_Y, 0.1));
        pointsMidR.push(new THREE.Vector3(startX + 8 * this.SQUARE_SIZE_X, startY + 5 * this.SQUARE_SIZE_Y, 0.1));
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsMidR), lineMaterial));


        // 九宮格斜線 (紅方)
        const p1 = new THREE.Vector3(startX + 3 * this.SQUARE_SIZE_X, startY, 0.1);
        const p2 = new THREE.Vector3(startX + 5 * this.SQUARE_SIZE_X, startY + 2 * this.SQUARE_SIZE_Y, 0.1);
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), lineMaterial));
        const p3 = new THREE.Vector3(startX + 5 * this.SQUARE_SIZE_X, startY, 0.1);
        const p4 = new THREE.Vector3(startX + 3 * this.SQUARE_SIZE_X, startY + 2 * this.SQUARE_SIZE_Y, 0.1);
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p3, p4]), lineMaterial));
        
        // 九宮格斜線 (黑方)
        const p5 = new THREE.Vector3(startX + 3 * this.SQUARE_SIZE_X, startY + 9 * this.SQUARE_SIZE_Y, 0.1);
        const p6 = new THREE.Vector3(startX + 5 * this.SQUARE_SIZE_X, startY + 7 * this.SQUARE_SIZE_Y, 0.1);
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p5, p6]), lineMaterial));
        const p7 = new THREE.Vector3(startX + 5 * this.SQUARE_SIZE_X, startY + 9 * this.SQUARE_SIZE_Y, 0.1);
        const p8 = new THREE.Vector3(startX + 3 * this.SQUARE_SIZE_X, startY + 7 * this.SQUARE_SIZE_Y, 0.1);
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p7, p8]), lineMaterial));
        
        // 添加隱形的點擊面，讓玩家可以點擊空格子
        const clickPlaneGeo = new THREE.PlaneGeometry(this.BOARD_WIDTH, this.BOARD_HEIGHT);
        const clickPlaneMat = new THREE.MeshBasicMaterial({ visible: false });
        const clickPlane = new THREE.Mesh(clickPlaneGeo, clickPlaneMat);
        clickPlane.name = "ClickPlane";
        clickPlane.position.z = 0.2; // 稍微高於棋盤線條
        this.scene.add(clickPlane);
    }
    
    // 將棋盤陣列索引 (row, col) 轉換為 3D 座標 (x, y)
    getGridPosition(row, col) {
        const startX = -this.BOARD_WIDTH / 2 + this.SQUARE_SIZE_X / 2;
        // row 0 在下面 (紅方)，row 9 在上面 (黑方)
        const startY = -this.BOARD_HEIGHT / 2 + this.SQUARE_SIZE_Y / 2;
        return {
            x: startX + col * this.SQUARE_SIZE_X,
            y: startY + row * this.SQUARE_SIZE_Y
        };
    }
    
    // 將 3D 座標轉換為棋盤陣列索引
    getGridIndex(x, y) {
        const startX = -this.BOARD_WIDTH / 2 + this.SQUARE_SIZE_X / 2;
        const startY = -this.BOARD_HEIGHT / 2 + this.SQUARE_SIZE_Y / 2;
        
        let col = Math.round((x - startX) / this.SQUARE_SIZE_X);
        let row = Math.round((y - startY) / this.SQUARE_SIZE_Y);
        
        if (row >= 0 && row < 10 && col >= 0 && col < 9) {
            return { row, col };
        }
        return null;
    }

    /* 🔍 棋子字的清晰度(2026-09-09 使用者退件:「字體模糊不清,越右邊越看不清楚」)
       兩個獨立的原因疊在一起,只修一個看起來還是模糊:
         ① 畫布本身:整支沒有 `setPixelRatio` ⇒ 手機 dpr=3 時 WebGL 只畫 1/3 解析度再放大
            (見 initThree 那段的修正)——這是「全畫面都糊」的那一半。
         ② 這張貼圖:128×128 太小,而且沒設 anisotropy ⇒ **斜視角**取樣會再糊一層。
            「越右邊越看不清」正是 ②:橫向時右側棋子離相機遠、入射角更斜,
            各向異性過濾沒開的話 mipmap 會挑到過度模糊的層級。
       ⇒ 貼圖加倍到 256(字 120px),並把 anisotropy 開到硬體上限。
       ⚠ anisotropy 要拿 `renderer.capabilities.getMaxAnisotropy()`,不可以寫死 16:
         寫死的話在不支援的裝置上 three 會靜靜夾回 1(沒有錯誤訊息,也沒有紅燈)。 */
    createPieceTexture(name, isRed) {
        const S = 256, C = S / 2;                  // 邊長與中心(原本 128/64,整體 ×2)
        const canvas = document.createElement('canvas');
        canvas.width = S;
        canvas.height = S;
        const ctx = canvas.getContext('2d');

        // 背景
        ctx.fillStyle = this.PALETTE.pieceFace;
        ctx.beginPath();
        ctx.arc(C, C, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.PALETTE.pieceRing;
        ctx.lineWidth = 8;
        ctx.stroke();

        // 內圈
        ctx.beginPath();
        ctx.arc(C, C, 96, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.stroke();

        // 文字
        ctx.fillStyle = isRed ? this.PALETTE.redInk : this.PALETTE.blackInk;
        ctx.font = 'bold 120px "楷体", "KaiTi", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, C, C);

        const texture = new THREE.CanvasTexture(canvas);
        if (this.renderer && this.renderer.capabilities) {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
        return texture;
    }
    
    /* ♟ 棋子是**兩層**圓柱:上層象牙白(帶字的頂面)、下層亮綠底座,而且下層**比上層寬**
         (2026-09-09 使用者退件:「參考站棋子有兩層,上層白色、下層底部螢光綠;
          另兩支底部深綠且只有一層」)。
       ★ 比例逐字取自參考站 `3d-chinese-chess/src/components/Piece.jsx`:
           上層 cylinder(0.40, 0.42, 0.15)、下層 cylinder(0.42, 0.45, 0.15)
         ⇒ 整顆是**往下微微外擴的錐台**,最寬處在最底部。
         本站把它等比縮放到「最寬處 = PIECE_RADIUS」⇒ 0.40:0.42:0.45 ÷ 0.45 × 4 = 3.56 : 3.73 : 4.00。
         ⚠ 最寬處**必須**維持 PIECE_RADIUS(=4):SQUARE_SIZE_Y 只有 8.5,
           底座若外擴到 4.3 ⇒ 直徑 8.6 > 8.5 ⇒ 上下相鄰的棋子會互相穿透。
       ⚠ 上層是 parent、下層是它的 child,不是兩個獨立 mesh —— 三個理由:
         ①`raycaster.intersectObjects(scene.children)` 是**非遞迴**的 ⇒ 只有 parent 被點得到,
           不會出現「點到底座但拿不到 userData.piece」的空指標。
         ②`updateBoardState` 只 remove parent,child 自動跟著走,不必另外記帳。
         ③ 染橘(setSelectedPiece)只要沿著 parent 找 userData.base 就拿得到底座材質。 */
    createPieceMesh(piece) {
        const R = this.PIECE_RADIUS;         // 最寬處(最底部)
        const rTop = R * (0.40 / 0.45);      // 3.556
        const rMid = R * (0.42 / 0.45);      // 3.733
        const half = this.PIECE_HEIGHT / 2;  // 上下層各佔一半

        /* 兩層都要做同樣的姿態轉換:Cylinder 預設沿 Y 軸立著,先 rotateX 讓它躺平、頂面朝 +Z。
           ★ 0902 使用者退件「棋子的字都要朝下轉 90 度」:r128 圓柱頂面的 UV 是 u↔z、v↔x,
             經 rotateX 後貼圖的「上」指向 +X(畫面右)、「右」指向 -Y(畫面下)⇒ 每個字順時針歪 90°。
             再繞 Z 軸轉 +90°(+X→+Y)把字扶正:字的上=遠端(黑方)、字的下=近端(紅方/鏡頭)。
           ⚠ translate 要在兩個 rotate **之後**才呼叫 —— 那時 geometry 的本地座標系已經是
             「+Z 朝上」,平移量才會落在厚度方向上;順序反過來會把上層推到旁邊去(而且畫面上
             看起來只是「棋子歪了」,不像 bug)。 */
        const poseAndLift = (geo, dz) => {
            geo.rotateX(Math.PI / 2);
            geo.rotateZ(Math.PI / 2);
            geo.translate(0, 0, dz);
            return geo;
        };

        const texture = this.createPieceTexture(piece.name, piece.color === 'red');

        // ── 上層(parent):象牙白側面 + 帶字的頂面 ──
        const upperGeo = poseAndLift(new THREE.CylinderGeometry(rTop, rMid, half, 32), half / 2);
        const ivory = new THREE.MeshPhongMaterial({ color: this.PALETTE.pieceUpper });
        const mesh = new THREE.Mesh(upperGeo, [
            ivory,                                          // 側面 = 象牙白(上層)
            new THREE.MeshPhongMaterial({ map: texture }),  // 頂面 = 象牙白 + 字
            ivory,                                          // 底面(被下層蓋住,看不到)
        ]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // ── 下層(child):亮綠底座,比上層寬 ──
        const baseGeo = poseAndLift(new THREE.CylinderGeometry(rMid, R, half, 32), -half / 2);
        const base = new THREE.Mesh(baseGeo, new THREE.MeshPhongMaterial({ color: this.PALETTE.pieceSide }));
        base.castShadow = true;
        base.receiveShadow = true;
        mesh.add(base);

        // 附加棋子資料供射線檢測使用;base 一起帶著,染橘/還原時要用
        mesh.userData = { piece: piece, base: base };
        return mesh;
    }
    
    updateBoardState(board) {
        /* ⚠ 這裡會把所有棋子 mesh 丟掉重建 ⇒ 先放掉「哪一顆被染橘」的記錄,
           不然 _selected 會指向一個已經 dispose 的 mesh(還原時寫到廢材質上,靜靜沒事但是錯的)。 */
        this.clearSelectedPiece();
        // 清除舊的棋子 meshes
        for (const key in this.pieceMeshes) {
            this.scene.remove(this.pieceMeshes[key]);
        }
        this.pieceMeshes = {};
        
        // 根據 board 狀態建立新的棋子
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (piece) {
                    const mesh = this.createPieceMesh(piece);
                    const pos = this.getGridPosition(row, col);
                    mesh.position.set(pos.x, pos.y, this.PIECE_HEIGHT / 2 + 0.1);
                    this.scene.add(mesh);
                    this.pieceMeshes[`${row},${col}`] = mesh;
                }
            }
        }
    }
    
    onMouseClick(event) {
        // 計算滑鼠在正規化設備座標中的位置 (-1 到 +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 檢測與場景中所有物件的交集
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        
        if (intersects.length > 0) {
            // 尋找被點擊的棋子或隱形點擊面
            let clickedObj = null;
            let intersectPoint = null;
            
            for (const intersect of intersects) {
                if (intersect.object.userData && intersect.object.userData.piece) {
                    clickedObj = intersect.object;
                    intersectPoint = intersect.point;
                    break;
                } else if (intersect.object.name === "ClickPlane") {
                    clickedObj = intersect.object;
                    intersectPoint = intersect.point;
                    // 如果有棋子在前面，通常會先被檢測到
                }
            }
            
            if (clickedObj) {
                let gridPos;
                if (clickedObj.name === "ClickPlane") {
                    // 點擊空地
                    gridPos = this.getGridIndex(intersectPoint.x, intersectPoint.y);
                } else {
                    // 點擊棋子，從 userData 中獲取 (或從位置反推)
                    gridPos = this.getGridIndex(clickedObj.position.x, clickedObj.position.y);
                }
                
                if (gridPos && this.onPieceClick) {
                    this.onPieceClick(gridPos.row, gridPos.col);
                }
            }
        }
    }
    
    /* 🟠 被選中 / 被提示的那顆棋子本身變橘色(2026-09-09 使用者拍板:
         「按下提示,被提示的棋子會變成橘色,這個很好,要學起來」)。
       學自 3d-chinese-chess(`src/components/Piece.jsx`):頂面 #f4a261、綠邊轉深綠 #2e7d32。
       ★ 為什麼有效:綠圈只是「加一個記號在旁邊」,棋子本身沒變 ⇒ 盤面越滿越難一眼找到;
         把那一顆整個換色是「改變主體」,在 32 顆白棋裡一眼就跳出來。綠圈綠點照舊保留
         (它們指的是「要走到哪」,和「是哪一顆」是兩件事)。
       ★ 實作用材質的 `color` 去乘貼圖,不重畫貼圖:頂面貼圖是象牙白底(接近白)⇒
         乘上橘色就變橘底,而字的紅/深藍還在(乘完仍看得出來)。成本是兩行,不用重建 texture。
       ⚠ 一定要記住「原本是什麼顏色」再還原,不可以還原成寫死的常數 ——
         哪天 PALETTE 改了,寫死的那份會把棋子還原成舊色,而且不會有任何紅燈。 */
    setSelectedPiece(row, col) {
        this.clearSelectedPiece();
        const mesh = this.pieceMeshes[`${row},${col}`];
        if (!mesh || !Array.isArray(mesh.material)) return;
        /* 棋子改成雙層之後,「邊」不再是 material[0](那是上層的象牙白側面),
           而是 child 底座 `userData.base`。上層的側面與頂面一起轉橘(參考站是把整個
           上層圓柱設成 #f4a261),底座轉深綠。
           ⚠ material[0] 與 material[2] 是**同一個材質物件**(上層側面+底面共用)
             ⇒ 記一份原色就夠,設一次就兩面都變。 */
        const face = mesh.material[1], upper = mesh.material[0];
        const base = mesh.userData && mesh.userData.base;
        this._selected = {
            mesh,
            faceColor: face.color.getHex(),
            upperColor: upper.color.getHex(),
            baseColor: base ? base.material.color.getHex() : null,
        };
        face.color.setHex(this.PALETTE.selFace);
        upper.color.setHex(this.PALETTE.selFace);
        if (base) base.material.color.setHex(this.PALETTE.selRim);
    }

    clearSelectedPiece() {
        const s = this._selected;
        if (!s) return;
        this._selected = null;
        if (!s.mesh || !Array.isArray(s.mesh.material)) return;
        s.mesh.material[1].color.setHex(s.faceColor);
        s.mesh.material[0].color.setHex(s.upperColor);
        const base = s.mesh.userData && s.mesh.userData.base;
        if (base && s.baseColor !== null) base.material.color.setHex(s.baseColor);
    }
    highlightSquare(row, col) {
        this.clearHighlights();
        this.setSelectedPiece(row, col);   // 🟠 那一顆本身也變橘(見上面註解)
        
        const pos = this.getGridPosition(row, col);
        const geo = new THREE.RingGeometry(this.PIECE_RADIUS + 0.5, this.PIECE_RADIUS + 1.5, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, 0.5);
        this.scene.add(mesh);
        this.highlightMeshes.push(mesh);
    }
    
    highlightMoves(moves) {
        moves.forEach(move => {
            const pos = this.getGridPosition(move.row, move.col);
            const geo = new THREE.CircleGeometry(1.5, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pos.x, pos.y, 0.5);
            this.scene.add(mesh);
            this.highlightMeshes.push(mesh);
        });
    }
    
    clearHighlights() {
        this.clearSelectedPiece();   // ⚠ 一起還原,否則選過的棋子會一直橘著
        this.highlightMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.highlightMeshes = [];
    }
    
    movePiece(fromRow, fromCol, toRow, toCol, callback) {
        // 為了簡單起見，直接更新狀態並呼叫 callback。
        // 在 Milestone 4 可以加入 Tween.js 做平滑動畫。
        // 這裡暫時實作一個非常簡單的線性移動動畫
        
        const mesh = this.pieceMeshes[`${fromRow},${fromCol}`];
        if (!mesh) {
            if (callback) callback();
            return;
        }
        
        const startPos = mesh.position.clone();
        const endPosGrid = this.getGridPosition(toRow, toCol);
        const endPos = new THREE.Vector3(endPosGrid.x, endPosGrid.y, this.PIECE_HEIGHT / 2 + 0.1);
        
        this.animatingPieces.push({
            mesh: mesh,
            startPos: startPos,
            endPos: endPos,
            startTime: performance.now(),
            duration: 300, // 300 毫秒
            callback: callback
        });
    }
    
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        /* ⚠ 只更新 aspect 不夠:長寬比一變,「要退多遠才裝得下」也變了。
             少了這一行,直向↔橫向轉一次棋盤就爆出畫面(0909 的病就是這樣長出來的)。 */
        this.fitCamera();
        // ⚠ dpr 會變(換螢幕/瀏覽器縮放)⇒ 這裡也要重設,不然轉一次方向就糊回去
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate(time) {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        // 處理動畫
        if (this.animatingPieces.length > 0) {
            const currentTime = performance.now();
            for (let i = this.animatingPieces.length - 1; i >= 0; i--) {
                const anim = this.animatingPieces[i];
                const elapsed = currentTime - anim.startTime;
                const progress = Math.min(elapsed / anim.duration, 1);
                
                // 簡單的線性插值
                anim.mesh.position.lerpVectors(anim.startPos, anim.endPos, progress);
                // 可以加點拋物線高度效果
                if (progress < 1) {
                    anim.mesh.position.z += Math.sin(progress * Math.PI) * 5;
                }
                
                if (progress >= 1) {
                    anim.mesh.position.copy(anim.endPos);
                    if (anim.callback) anim.callback();
                    this.animatingPieces.splice(i, 1);
                }
            }
        }
        
        if (this.controls) this.controls.update();

        /* 側面補光的**方位角**跟著相機轉,仰角固定壓低(見 Lights 段的算式)。
           不跟的話:轉到棋盤另一側時,面向相機的那半圈側面對兩顆光都是背光
           ⇒ 綠底座又只剩環境光 0.55 ⇒ 使用者退掉的深綠原地復活,而且只在某些角度出現
           (最難查的那種:截圖角度剛好對就看不到)。 */
        if (this.fillLight && this.camera) {
            const c = this.camera.position;
            const d = Math.hypot(c.x, c.y) || 1;
            this.fillLight.position.set((c.x / d) * 120, (c.y / d) * 120, 10);
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}