const ScreenManagerComponent = Vue.component('screenmanagercomponent', {
    template: `
    <div class="screenManager" 
        ref="screenManager"
        v-on:mouseup.left="mouseReleased"
        v-on:mousemove="mouseMove"
    >
        <ScreenComponent
            v-for="screen in Screens"
            v-bind:key="screen.id"
            v-bind="screen"
            v-on:selected="screenSelected"
        ></ScreenComponent>
    </div>`,


    data: function() {
        return {
            Screens: [],
            SelectedScreenId: -1
        }
    },

    components: {
        'ScreenComponent': ScreenComponent
    },

    computed: {
        element: function() {
            return this.$refs.screenManager;
        },

        height: function() {
            return this.element.clientHeight - this.element.clientTop;
        },
        width: function() {
            return this.element.clientWidth - this.element.clientLeft;
        },
        x: function() {
            return this.element.clientLeft;
        },
        y: function() {
            return this.element.clientTop;
        }
    },

    methods: {
        getScreen: function(id) {
            return this.Screens.find((screen) => screen.Id === id) || null;
        },

        placeScreen: function(id, x, y) {
            console.log(`input: ${id} ${x} ${y}`)

            let screen = this.getScreen(id);

            console.log(`compare`, this.Screens.map(screen => screen.Id))


            if (screen == null) {
                console.log("[error] invalid selected screen id!");
                return;
            }


            screen.VisualX = x;
            screen.VisualY = y;
        },

        screenSelected: function(data) {
            this.SelectedScreenId = data.Id;

            let screen = this.getScreen(this.SelectedScreenId);

            if (screen == null) {
                console.log("[error] invalid selected screen id!");
                return;
            }

            this.SelectX = data.X - screen.VisualX;
            this.SelectY = data.Y - screen.VisualY;
        },

        screenCenter: function(screen) {
            let centerX = this.x + this.width / 2;
            let centerY = this.y + this.height / 2;

            screen.SetPositionWithCenter(centerX, centerY);
        },

        screenUnselected: function() {
            this.SelectedScreenId = -1;
        },

        screenFindClosestScreen: function(screen) {
            let minDistance = Number.MAX_VALUE;
            let closestScreen = this.Screens[0];

            this.Screens.forEach(otherScreen => {
                if (otherScreen === screen) {
                    return;
                }

                let distance = screen.GetDistanceToClosestScreenCorner(otherScreen);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestScreen = otherScreen;
                }
            });

            return closestScreen;
        },

        screenCalculatePositions: function() {
            this.Screens.forEach(screen => {
                let anchor = this.Screens[0];


                screen.X = (screen.VisualX - anchor.VisualX) / anchor.Scale;
                screen.Y = (screen.VisualY - anchor.VisualY) / anchor.Scale;
            });
        },

        ResolveCollisions: function() {
            this.Screens.forEach(screen => {
                this.Screens.forEach(otherScreen => {
                    if (screen === otherScreen) {
                        return;
                    }

                    if (screen.AreColliding(otherScreen)) {
                        screen.SnapOutside(otherScreen);
                    }
                });
            });
        },

        ResolveSnaps: function() {
            this.Screens.forEach(screen => {
                let closestX = Number.MAX_VALUE;
                let closestY = Number.MAX_VALUE;
                let closestScreen = null;

                this.Screens.forEach(otherScreen => {
                    if (screen === otherScreen) {
                        return;
                    }

                    if (closestScreen == null) {
                        closestScreen = otherScreen;
                    }

                    let snapVector = screen.GetSnapVector(otherScreen);

                    if (Math.abs(snapVector.x) < closestX) {
                        closestX = Math.abs(snapVector.x);
                        closestScreen = otherScreen;
                    }
                    if (Math.abs(snapVector.y) < closestY) {
                        closestY = Math.abs(snapVector.y);
                        closestScreen = otherScreen;
                    }
                });
                //console.log(screen.Id, closestEdge);
                if (closestScreen != null && (closestX > 1 || closestY > 1)) {

                    console.log("snap needed");

                    screen.SnapOutside(closestScreen);
                }
            });
        },

        mouseMove: function(event) {
            if (this.SelectedScreenId < 0) {
                return;
            }

            let screen = this.getScreen(this.SelectedScreenId);

            if (screen == null) {
                console.log("[error] invalid selected screen id!");
                return;
            }

            screen.VisualX = event.x - this.SelectX;
            screen.VisualY = event.y - this.SelectY;
            this.$emit('screen_update');
        },

        mouseReleased: function(event) {
            let screen = this.getScreen(this.SelectedScreenId);

            if (screen === null) {
                return;
            }

            let target = this.screenFindClosestScreen(screen);
            //screen.SnapAside(this.Screens[0], 0.6, -1);

            let snapVector = screen.GetSnapVector(target);
            snapVector.x = Screen.Clamp(snapVector.x, -1, 1);
            snapVector.y = Screen.Clamp(snapVector.y, -1, 1);

            screen.SnapAside(target, snapVector.x, snapVector.y);

            if (screen.AreColliding(target)) {
                screen.SnapOutside(target);
            }

            this.ResolveCollisions();
            this.ResolveSnaps();
            this.ResolveCollisions();

            this.screenCalculatePositions();
            this.$emit('screen_update');

            this.screenUnselected();
        }
    },
});