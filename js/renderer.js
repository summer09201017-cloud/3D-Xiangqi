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
        this.scene.background = new THREE.Color(0x333333);
        
        // 2. Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, -60, 90); // 調整視角
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
        // 允許玩家水平 360 度任意旋轉觀看棋盤
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        // 放寬垂直視角限制，讓玩家可以從正上方甚至稍微從底部觀看
        this.controls.maxPolarAngle = Math.PI; // 允許轉到棋盤正下方
        this.controls.minPolarAngle = 0; // 允許轉到正上方純 2D 視角
        
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
    
    createBoard() {
        // 棋盤本體 (木頭顏色)
        const boardGeo = new THREE.BoxGeometry(this.BOARD_WIDTH, this.BOARD_HEIGHT, this.BOARD_THICKNESS);
        const boardMat = new THREE.MeshPhongMaterial({ color: 0xd2b48c }); // 木頭色
        this.boardMesh = new THREE.Mesh(boardGeo, boardMat);
        this.boardMesh.receiveShadow = true;
        // 把棋盤表面放在 z=0 平面
        this.boardMesh.position.z = -this.BOARD_THICKNESS / 2;
        this.scene.add(this.boardMesh);
        
        // 繪製棋盤線條 (簡單的線段)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
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
        ctx.fillStyle = '#f0d9b5';
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 4;
        ctx.stroke();

        // 內圈
        ctx.beginPath();
        ctx.arc(64, 64, 48, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 文字
        ctx.fillStyle = isRed ? '#ff0000' : '#000000';
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
        
        const texture = this.createPieceTexture(piece.name, piece.color === 'red');
        
        // 材質陣列：側面使用木頭色，頂面使用帶有文字的紋理
        const materials = [
            new THREE.MeshPhongMaterial({ color: 0xe0c090 }), // 側面
            new THREE.MeshPhongMaterial({ map: texture }),     // 頂面
            new THREE.MeshPhongMaterial({ color: 0xe0c090 })  // 底面
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