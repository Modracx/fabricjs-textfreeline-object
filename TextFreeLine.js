/*!
 * fabric.TextFreeLine — free-line text-on-bezier effect (rigid placement)
 * Kenneth D'silva (Modracx), Copyright (c) June 2025
 * Licensed under the MIT License — https://opensource.org/licenses/MIT
 *
 * No external dependencies. Font via fontFamily (same as fabric.IText).
 *
 * Rendering: each character is placed as a rigid body — translated to the
 * path point and rotated to follow the tangent (baseline stays on path).
 * This matches the reference rigidGlyphs() behaviour for freeLine.
 */
;(function (fabric) {
    'use strict';

    class _CubicSeg {
        constructor(p0,p1,p2,p3){this.p=[p0,p1,p2,p3];this._build();}
        _pt(t){const[p0,p1,p2,p3]=this.p,u=1-t;return{x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};}
        _tan(t){const[p0,p1,p2,p3]=this.p,u=1-t,dx=3*(u*u*(p1.x-p0.x)+2*u*t*(p2.x-p1.x)+t*t*(p3.x-p2.x)),dy=3*(u*u*(p1.y-p0.y)+2*u*t*(p2.y-p1.y)+t*t*(p3.y-p2.y)),n=Math.hypot(dx,dy)||1;return{x:dx/n,y:dy/n};}
        _build(N=200){this._lut=[{t:0,d:0}];let prev=this._pt(0),acc=0;for(let i=1;i<=N;i++){const t=i/N,cur=this._pt(t);acc+=Math.hypot(cur.x-prev.x,cur.y-prev.y);this._lut.push({t,d:acc});prev=cur;}this.length=acc;}
        _tFor(d){let lo=0,hi=this._lut.length-1;while(lo<hi-1){const m=(lo+hi)>>1;this._lut[m].d<d?lo=m:hi=m;}const a=this._lut[lo],b=this._lut[hi];return b.d===a.d?a.t:a.t+(d-a.d)/(b.d-a.d)*(b.t-a.t);}
        at(d){return this._pt(this._tFor(Math.max(0,Math.min(d,this.length))));}
        tan(d){return this._tan(this._tFor(Math.max(0,Math.min(d,this.length))));}
    }
    class _BezierPath {
        constructor(pts){
            if(pts.length===2){const m={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};this._s=[new _CubicSeg(pts[0],m,m,pts[1])];}
            else{this._s=[new _CubicSeg(pts[0],pts[1],pts[2],pts[3]),new _CubicSeg(pts[3],pts[4],pts[5],pts[6])];}
            this.length=this._s.reduce((a,s)=>a+s.length,0);
        }
        _res(d){d=Math.max(0,Math.min(d,this.length));let s=this._s[0];if(this._s.length>1&&d>s.length){d-=s.length;s=this._s[1];}return{s,d};}
        at(d){const{s,d:r}=this._res(d);return s.at(r);}
        tan(d){const{s,d:r}=this._res(d);return s.tan(r);}
    }

    const _DEFAULT_CTRL_PTS = [
        {x:0,y:1},{x:1/6,y:1},{x:2/6,y:.8},{x:.5,y:.8},{x:4/6,y:.8},{x:5/6,y:1},{x:1,y:1},
    ];

    fabric.TextFreeLine = fabric.util.createClass(fabric.IText, {
        type: 'text-free-line',
        ctrlPts: null,
        kerning: 0,
        flipped: false,
        cacheProperties: fabric.IText.prototype.cacheProperties.concat(['ctrlPts','kerning','flipped']),

        initialize: function(text, options) {
            options = options || {};
            this.ctrlPts = options.ctrlPts != null ? options.ctrlPts : _DEFAULT_CTRL_PTS.map(p=>({x:p.x,y:p.y}));
            this.kerning = options.kerning != null ? options.kerning : 0;
            this.flipped = options.flipped != null ? options.flipped : false;
            this.callSuper('initialize', text, options);
            this.originX = options.originX != null ? options.originX : 'left';
            this.originY = options.originY != null ? options.originY : 'top';
            this._updateCurve();
        },

        set: function(key, value) {
            const changed = this.callSuper('set', key, value);
            const watched = ['text','fontSize','fontFamily','fontWeight','fontStyle','fontVariant','kerning','ctrlPts','flipped'];
            const dirty = typeof key === 'object' ? Object.keys(key).some(k=>watched.includes(k)) : watched.includes(key);
            if (dirty && !this.isEditing) this._updateCurve();
            return changed;
        },

        enterEditing: function() { this.callSuper('enterEditing'); this._flatLayout(); this.setCoords(); },
        exitEditing:  function() { this.callSuper('exitEditing');  this._updateCurve(); this.setCoords(); if(this.canvas)this.canvas.requestRenderAll(); },

        _flatLayout: function() {
            const ctx = fabric.util.createCanvasElement().getContext('2d');
            ctx.font = this._getFontDeclaration();
            const chars = this.text.split('').filter(c=>c!=='\n');
            let w = chars.reduce((s,ch)=>s+ctx.measureText(ch).width, 0);
            if(chars.length>1) w += this.kerning*(chars.length-1);
            this.set({ width:Math.max(1,Math.round(w)), height:Math.max(1,Math.round(this.fontSize*1.2)) });
        },

        _updateCurve: function() {
            if(!this.ctrlPts){this._flatLayout();return;}
            const ctx = fabric.util.createCanvasElement().getContext('2d');
            ctx.font = this._getFontDeclaration();
            const chars = this.text.split('').filter(c=>c!=='\n');
            const n = chars.length;
            if(!n){this._flatLayout();return;}
            const cw = chars.map(ch=>ctx.measureText(ch).width);
            const W = cw.reduce((s,w)=>s+w,0) + this.kerning*Math.max(0,n-1);
            const H = this.fontSize;
            const pts = this.ctrlPts.map(p=>({x:p.x*W,y:p.y*H}));
            const path = new _BezierPath(pts);
            const L = path.length;
            const leftOff = Math.max((L-W)/2, 0);
            // Bounding box: rotate each character's corner box by the tangent angle
            const asc=H*0.80, desc=H*0.20;
            let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
            let xPos=0;
            for(let i=0;i<n;i++){
                const charCx=xPos+cw[i]/2+leftOff; xPos+=cw[i]+this.kerning;
                const pt=path.at(charCx); const tn=path.tan(charCx);
                const θ=Math.atan2(tn.y,tn.x)+(this.flipped?Math.PI:0);
                const cos=Math.cos(θ), sin=Math.sin(θ), hw=cw[i]/2;
                [[-hw,-asc],[hw,-asc],[hw,desc],[-hw,desc]].forEach(([dx,dy])=>{
                    const x=pt.x+dx*cos-dy*sin, y=pt.y+dx*sin+dy*cos;
                    if(x<minX)minX=x; if(x>maxX)maxX=x;
                    if(y<minY)minY=y; if(y>maxY)maxY=y;
                });
            }
            const width=Math.max(1,maxX-minX), height=Math.max(1,maxY-minY);
            this._bbX=minX+width/2; this._bbY=minY+height/2;
            this._path=path; this._cw=cw; this._chars=chars;
            this._H=H; this._L=L; this._leftOff=leftOff;
            this.set({width,height});
        },

        _render: function(ctx) {
            if(this.isEditing||!this._path){this.callSuper('_render',ctx);return;}
            const {_chars:chars,_cw:cw,_path:path,_H:H,_L:L,_leftOff:leftOff,flipped}=this;
            ctx.save();
            ctx.font=this._getFontDeclaration();
            ctx.textBaseline='alphabetic'; ctx.textAlign='center';
            ctx.fillStyle=this.fill;
            ctx.translate(-(this._bbX||0),-(this._bbY||0));
            let xPos=0;
            for(let i=0;i<chars.length;i++){
                const charCx=xPos+cw[i]/2+leftOff; xPos+=cw[i]+this.kerning;
                if(charCx<0||charCx>L)continue;
                const pt=path.at(charCx); const tn=path.tan(charCx);
                const θ=Math.atan2(tn.y,tn.x)+(flipped?Math.PI:0);
                ctx.save();
                ctx.translate(pt.x,pt.y); ctx.rotate(θ);
                if(this.stroke&&this.strokeWidth>0){ctx.strokeStyle=this.stroke;ctx.lineWidth=this.strokeWidth;ctx.strokeText(chars[i],0,0);}
                ctx.fillText(chars[i],0,0);
                ctx.restore();
            }
            ctx.restore();
        },

        toObject: function(props){ return this.callSuper('toObject',['ctrlPts','kerning','flipped'].concat(props||[])); },
    });

    fabric.TextFreeLine.fromObject = function(object,callback,forceAsync){
        return fabric.Object._fromObject('TextFreeLine',object,callback,forceAsync);
    };
})(typeof fabric !== 'undefined' ? fabric : require('fabric').fabric);
