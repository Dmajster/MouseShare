const ScreenComponent = Vue.component('screencomponent', {
    template: `
    <div class="screen" :style="style" v-on:mousedown.left="selected">
        <p>Owner: {{ ConnectionId || 'Host' }}</p>
        <p>ID: {{ Id.substring(0,18) }}</p>
        <p>Dimensions: {{ Width }} X {{ Height }}</p>
        <p>Position: {{ X.toFixed(1)}},{{Y.toFixed(1)}}</p>
    </div>`,

    props: {
        Id: { default: -1, type: String },
        X: { default: 0, type: Number },
        Y: { default: 0, type: Number },
        Width: { default: 1920, type: Number },
        Height: { default: 1080, type: Number },
        ConnectionId: { default: "None", type: String },
        RealX: { default: 0, type: Number },
        RealY: { default: 0, type: Number },
        Scale: { default: 0.1, type: Number },
        VisualX: { default: 0, type: Number },
        VisualY: { default: 0, type: Number },
    },

    computed: {
        style: function() {
            return {
                left: `${this.VisualX}px`,
                top: `${this.VisualY}px`,
                width: `${this.Width * this.Scale}px`,
                height: `${this.Height * this.Scale}px`
            };
        }
    },

    methods: {
        selected: function(event) {
            this.$emit("selected", {
                Id: this.Id,
                X: event.x,
                Y: event.y
            });
        }
    }
})