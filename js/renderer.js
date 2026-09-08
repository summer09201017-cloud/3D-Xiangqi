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
              ⇒ 所以配色**不必**靠截圖目測,直接抄它的原始碼精確值(下面這幾個就是):
                `src/components/Piece.jsx`(棋子面/綠邊/紅字/黑字)、`src/components/Board.jsx`
                (盤面 #ebc38a、格線 #594433)、`src/App.jsx`(背景 #2c3e50)。
              第一版我目測的值(bg 0x2f4050 / boardTop 0xece0c0 / gridLine 0x5b3a1a /
              pieceSide 0x3fa84c / face #f8f5ee / red #d81f26 / black #1b2a5e)都很接近但不精確,
              已全部換成上面那份原始碼的值。boardSide 是唯一「推」出來的:參考站的盤是平面、沒有側面色。
           ★ 參考站的「選中/被提示的棋子」是**橘色** `#f4a261` 頂面 + 深綠 `#2e7d32` 邊。
             本站不抄那一套:本站的提示是綠圈 + 綠點(不動棋子本身的顏色),兩者不要混。
           改之前(整片偏黃褐、和背景糊在一起):棋盤 0xd2b48c、格線 0x000000、
             棋子頂 #f0d9b5 + 棕圈、棋子側 0xe0c090、紅字 #ff0000、黑字 #000000、背景 0x333333。 */
        this.PALETTE = {
            bg: 0x2c3e50,          // 背景:深板岩藍(App.jsx 的 <color background>)
            /* 盤面/盤側 ⚠ **刻意不用參考站的十六進位值**(它是 0xebc38a)。
               同一個色碼在不同的材質與燈光下**不是同一個顏色**:參考站是 R3F 的
               meshStandardMaterial + roughness 0.8,本站是 MeshPhongMaterial + 環境光 0.6
               + 平行光 0.8 ⇒ 照抄 0xebc38a 渲出來明顯偏黃(實機截圖比對過),
               反而比目測值離參考站的觀感**更遠**。⇒ 這兩個值以「看起來像不像截圖」為準,不是以色碼為準。 */
            boardTop: 0xece0c0,    // 盤面:米白(對齊截圖觀感,不是對齊色碼)
            boardSide: 0xdcc9a0,   // 盤側(厚度)比盤面深一階(參考站是平面盤,沒有側面色)
            gridLine: 0x594433,    // 格線:深咖啡(Board.jsx lineColor)—— 不是黑
            pieceSide: 0x4caf50,   // ★ 棋子綠邊 = 使用者說的「綠底棋子」(Piece.jsx 下半圓柱)
            pieceFace: '#fdfaf6',  // 棋子頂面:象牙白(Piece.jsx 上半圓柱)
            pieceRing: '#cfc7b5',  // 頂面那兩圈:柔和的灰 ★ 本站自有,參考站的字是 3D Text、沒有圈
            redInk: '#e63946',     // 紅方的字(Piece.jsx)
            blackInk: '#1d3557',   // 黑方的字:深藍(Piece.jsx)—— 不是黑
        };

        // 常數設定
        this.SQUARE_SIZE_X = 10;
        this.SQUARE_SIZE_Y = 8.5; // 讓棋盤長度(Y軸)短一點，符合視覺比例
        this.BOARD_WIDTH = 9 * this.SQUARE_SIZE_X;
        this.BOARD_HEIGHT = 10 * this.SQUARE_SIZE_Y;
        this.BOARD_THICKNESS = 4;
        this.PIECE_RADIUS = 4;
        this.PIECE_HEIGHT = 2;
        
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

        // 5. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 50, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
        
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

    createPieceTexture(name, isRed) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // 背景
        ctx.fillStyle = this.PALETTE.pieceFace;
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.PALETTE.pieceRing;
        ctx.lineWidth = 4;
        ctx.stroke();

        // 內圈
        ctx.beginPath();
        ctx.arc(64, 64, 48, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 文字
        ctx.fillStyle = isRed ? this.PALETTE.redInk : this.PALETTE.blackInk;
        ctx.font = 'bold 60px "楷体", "KaiTi", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    createPieceMesh(piece) {
        const geometry = new THREE.CylinderGeometry(this.PIECE_RADIUS, this.PIECE_RADIUS, this.PIECE_HEIGHT, 32);
        // Cylinder 預設是立著的，沿著 Y 軸。我們要讓它躺平在棋盤上，並旋轉 90 度使得頂部朝上 (Z軸正向)
        geometry.rotateX(Math.PI / 2);
        // ★ 0902 使用者退件「棋子的字都要朝下轉 90 度」:r128 圓柱頂面的 UV 是 u↔z、v↔x,
        //   經上面 rotateX 後貼圖的「上」指向 +X(畫面右)、「右」指向 -Y(畫面下)⇒ 每個字順時針歪 90°。
        //   再繞 Z 軸轉 +90°(+X→+Y)把字扶正:字的上=遠端(黑方)、字的下=近端(紅方/鏡頭),所有棋子都正著讀。
        geometry.rotateZ(Math.PI / 2);
        
        const texture = this.createPieceTexture(piece.name, piece.color === 'red');
        
        // 材質陣列：側面使用木頭色，頂面使用帶有文字的紋理
        const greenRim = new THREE.MeshPhongMaterial({ color: this.PALETTE.pieceSide });
        const materials = [
            greenRim,                                       // 側面 = 綠(使用者指定的「綠底棋子」)
            new THREE.MeshPhongMaterial({ map: texture }),  // 頂面 = 象牙白 + 字
            greenRim                                        // 底面
        ];
        
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // 附加棋子資料供射線檢測使用
        mesh.userData = { piece: piece };
        return mesh;
    }
    
    updateBoardState(board) {
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
    
    highlightSquare(row, col) {
        this.clearHighlights();
        
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