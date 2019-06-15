class Screen {
    constructor(id, width, height, x, y, realX, realY, connectionId, scale) {
        this.Id = id;
        this.X = x;
        this.Y = y;
        this.RealX = realX;
        this.RealY = realY;
        this.Width = width;
        this.Height = height;
        this.ConnectionId = connectionId;
        this.Scale = scale;

        this.VisualX = this.X;
        this.VisualY = this.Y;
    }

    get VisualWidth() {
        return this.Width * this.Scale;
    }

    get VisualHeight() {
        return this.Height * this.Scale;
    }

    get VisualCenterX() {
        return this.VisualX + this.VisualWidth / 2;
    }

    get VisualCenterY() {
        return this.VisualY + this.VisualHeight / 2;
    }

    get CenterX() {
        return this.X + this.Width / 2;
    }

    get CenterY() {
        return this.Y + this.Height / 2;
    }

    get VisualCorners() {
        return [
            { x: this.VisualX, y: this.VisualY },
            { x: this.VisualX + this.VisualWidth, y: this.VisualY },
            { x: this.VisualX + this.VisualWidth, y: this.VisualY + this.VisualHeight },
            { x: this.VisualX, y: this.VisualY + this.VisualHeight }
        ]
    }


    static Distance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
        );
    }

    static Clamp(number, min, max) {
        return Math.max(min, Math.min(number, max));
    }

    SnapAside(target, x, y) {
        let centerX = target.VisualCenterX + x * (target.VisualWidth / 2 + this.VisualWidth / 2);
        let centerY = target.VisualCenterY + y * (target.VisualHeight / 2 + this.VisualHeight / 2);

        this.SetPositionWithCenter(centerX, centerY);
    }

    SetPositionWithCenter(x, y) {
        this.VisualX = x - this.VisualWidth / 2;
        this.VisualY = y - this.VisualHeight / 2;
    }

    GetDistanceToClosestScreenCorner(target) {
        let corners = this.VisualCorners;
        let targetCorners = target.VisualCorners;
        let minDistance = Number.MAX_SAFE_INTEGER;

        corners.forEach(corner => {
            targetCorners.forEach(targetCorner => {
                let distance = Screen.Distance(corner, targetCorner);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            });
        });

        return minDistance;
    }

    GetSnapVector(target) {
        let x = (this.VisualCenterX - target.VisualCenterX) / (this.VisualWidth / 2 + target.VisualWidth / 2)
        let y = (this.VisualCenterY - target.VisualCenterY) / (this.VisualHeight / 2 + target.VisualHeight / 2)

        return {
            x: x,
            y: y
        }
    }

    AreColliding(target) {
        return (this.VisualX < target.VisualX + target.VisualWidth &&
            this.VisualX + this.VisualWidth > target.VisualX &&
            this.VisualY < target.VisualY + target.VisualHeight &&
            this.VisualY + this.VisualHeight > target.VisualY)
    }

    SnapOutside(target) {
        let deltaX = this.VisualCenterX - target.VisualCenterX;
        let deltaY = this.VisualCenterY - target.VisualCenterY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            this.SnapAside(
                target,
                deltaX < 0 ? -1 : 1,
                Math.abs(deltaY) < 1 ? deltaY : 0
            );
        } else {
            this.SnapAside(
                target,
                Math.abs(deltaX) < 1 ? deltaX : 0,
                deltaY < 0 ? -1 : 1
            );
        }
    }
}