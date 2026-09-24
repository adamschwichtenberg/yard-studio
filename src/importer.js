/* Inline-ready, dependency-free. Place after import.html. No network access. */
(function piiImporter(piiGlobal) {
  "use strict";
  const piiLimits = Object.freeze({fileBytes:20*1024*1024, dimension:8192, pixels:24000000,
    workDimension:1200, workPixels:1000000, corners:128, contourSteps:200000});
  const piiNS = "http://www.w3.org/2000/svg";
  const piiClone = value => JSON.parse(JSON.stringify(value));
  const piiClamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const piiDistance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
  function piiArea(points) {
    let area = 0;
    for(let i=0; i<points.length; i++) {
      const a=points[i], b=points[(i+1)%points.length];
      area += a.x*b.y-b.x*a.y;
    }
    return Math.abs(area/2);
  }
  function piiBounds(points) {
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    for(const p of points) { x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); }
    return {x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2};
  }
  function piiCross(a,b,c) { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
  function piiOnSegment(a,b,p) {
    return Math.abs(piiCross(a,b,p))<1e-8 && p.x>=Math.min(a.x,b.x)-1e-8 &&
      p.x<=Math.max(a.x,b.x)+1e-8 && p.y>=Math.min(a.y,b.y)-1e-8 && p.y<=Math.max(a.y,b.y)+1e-8;
  }
  function piiIntersects(a,b,c,d) {
    const x=piiCross(a,b,c), y=piiCross(a,b,d), z=piiCross(c,d,a), w=piiCross(c,d,b);
    return ((x>0 && y<0 || x<0 && y>0) && (z>0 && w<0 || z<0 && w>0)) ||
      piiOnSegment(a,b,c) || piiOnSegment(a,b,d) || piiOnSegment(c,d,a) || piiOnSegment(c,d,b);
  }
  function piiValidate(points) {
    if(!Array.isArray(points) || points.length<3) return "At least three corners are required.";
    if(points.length>piiLimits.corners) return "Too many corners (maximum 128). Increase simplification or trace manually.";
    if(points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return "Corner coordinates must be finite.";
    for(let i=0;i<points.length;i++) {
      const a=points[i], b=points[(i+1)%points.length], c=points[(i+2)%points.length];
      if(piiDistance(a,b)<0.05) return "Two adjacent corners overlap or form a zero-length side.";
      if(Math.abs(piiCross(a,b,c))<1e-8 && (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)<0)
        return "Adjacent sides double back and overlap.";
      for(let j=i+1;j<points.length;j++) {
        if(j===i+1 || i===0 && j===points.length-1) continue;
        if(piiIntersects(a,b,points[j],points[(j+1)%points.length])) return "Sides intersect or touch. Move or remove corners.";
      }
    }
    if(piiArea(points)<1) return "Boundary area is too small or the corners are collinear.";
    return "";
  }
  function piiTraceTarget(points,point,scaleX,scaleY,pointerType="mouse") {
    const radius=pointerType==="touch" ? 28:20;
    let index=-1, nearest=radius;
    for(let i=0;i<points.length;i++) {
      const distance=Math.hypot((points[i].x-point.x)*scaleX,(points[i].y-point.y)*scaleY);
      if(distance<=nearest && (index<0 || distance<nearest)) { index=i; nearest=distance; }
    }
    if(index<0) return null;
    const error=index===0 ? piiValidate(points) :
      index===points.length-1 ? "This is the most recent corner. Add a different corner or close at Start (corner 1)." :
        "Close at Start (corner 1), not this corner. All drawn corners will be kept.";
    return {index,error,radius};
  }
  function piiSegmentDistance(p,a,b) {
    const dx=b.x-a.x, dy=b.y-a.y, den=dx*dx+dy*dy;
    const t=den ? piiClamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1) : 0;
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  }
  function piiRDP(points,epsilon) {
    if(points.length<3) return points.slice();
    const keep=new Uint8Array(points.length), stack=[[0,points.length-1]];
    keep[0]=keep[points.length-1]=1;
    let comparisons=0;
    while(stack.length) {
      const [start,end]=stack.pop();
      let far=epsilon, index=-1;
      for(let i=start+1;i<end;i++) {
        if(++comparisons>2000000) return null;
        const distance=piiSegmentDistance(points[i],points[start],points[end]);
        if(distance>far) { far=distance; index=i; }
      }
      if(index>=0) { keep[index]=1; stack.push([start,index],[index,end]); }
    }
    return points.filter((_,i)=>keep[i]);
  }
  function piiSimplify(points,epsilon) {
    if(points.length<4) return points.slice();
    let split=1;
    for(let i=2;i<points.length;i++) if(piiDistance(points[0],points[i])>piiDistance(points[0],points[split])) split=i;
    const first=piiRDP(points.slice(0,split+1),epsilon);
    const second=piiRDP(points.slice(split).concat([points[0]]),epsilon);
    return first && second ? first.slice(0,-1).concat(second.slice(0,-1)) : [];
  }
  function piiHue(r,g,b) {
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    if(!d) return 0;
    const h=max===r ? (g-b)/d : max===g ? (b-r)/d+2 : (r-g)/d+4;
    return (h*60+360)%360;
  }
  function piiMask(data,width,height,mode,sensitivity,hue) {
    const mask=new Uint8Array(width*height);
    const dark=55+sensitivity*1.8, chroma=110-sensitivity*0.75;
    for(let i=0,j=0;i<mask.length;i++,j+=4) {
      const alpha=data[j+3]/255;
      const r=data[j]*alpha+255*(1-alpha), g=data[j+1]*alpha+255*(1-alpha), b=data[j+2]*alpha+255*(1-alpha);
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      if(mode==="dark") mask[i]=0.2126*r+0.7152*g+0.0722*b<dark && max-min<80 ? 1 : 0;
      else if(max-min>=chroma && max>100 && (max-min)/max>0.3) {
        const distance=hue===null ? 0 : Math.abs(piiHue(r,g,b)-hue);
        mask[i]=hue===null || Math.min(distance,360-distance)<=25 ? 1 : 0;
      }
    }
    return mask;
  }
  function piiDilate(mask,width,height,radius) {
    if(!radius) return mask;
    const temp=new Uint8Array(mask.length), out=new Uint8Array(mask.length);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      for(let dx=-radius;dx<=radius;dx++) if(x+dx>=0 && x+dx<width && mask[y*width+x+dx]) { temp[y*width+x]=1; break; }
    }
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      for(let dy=-radius;dy<=radius;dy++) if(y+dy>=0 && y+dy<height && temp[(y+dy)*width+x]) { out[y*width+x]=1; break; }
    }
    return out;
  }
  function piiRegions(mask,width,height,seed) {
    const labels=new Int32Array(mask.length), queue=new Int32Array(mask.length);
    const regions=[];
    let id=0;
    function piiFill(start) {
      id++;
      let head=0,tail=1,border=false,x0=width,y0=height,x1=0,y1=0;
      queue[0]=start; labels[start]=id;
      while(head<tail) {
        const p=queue[head++], x=p%width, y=Math.floor(p/width);
        if(x===0 || y===0 || x===width-1 || y===height-1) border=true;
        x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y);
        if(x>0 && !mask[p-1] && !labels[p-1]) { labels[p-1]=id; queue[tail++]=p-1; }
        if(x+1<width && !mask[p+1] && !labels[p+1]) { labels[p+1]=id; queue[tail++]=p+1; }
        if(y>0 && !mask[p-width] && !labels[p-width]) { labels[p-width]=id; queue[tail++]=p-width; }
        if(y+1<height && !mask[p+width] && !labels[p+width]) { labels[p+width]=id; queue[tail++]=p+width; }
      }
      if(!border && tail>=Math.max(25,mask.length*(seed ? 0.0001 : 0.006))) {
        // Retain only the largest components, not a potentially unbounded noise list.
        regions.push({id,count:tail,start,x0,y0,x1,y1});
        regions.sort((a,b)=>b.count-a.count);
        if(regions.length>16) regions.pop();
      }
    }
    if(seed) {
      const x=piiClamp(Math.floor(seed.x),0,width-1), y=piiClamp(Math.floor(seed.y),0,height-1), p=y*width+x;
      if(!mask[p]) piiFill(p);
    } else for(let p=0;p<mask.length;p++) if(!mask[p] && !labels[p]) piiFill(p);
    return {labels,regions};
  }
  function piiTraceContour(labels,width,height,region) {
    const id=region.id;
    const piiInside=(x,y)=>x>=0 && y>=0 && x<width && y<height && labels[y*width+x]===id;
    // Directed lattice edges keep the region on the right. This traces its actual
    // outer contour, including re-entrant corners, rather than a box or hull.
    function piiEdge(x,y,d) {
      if(d===0) return piiInside(x,y) && !piiInside(x,y-1);
      if(d===1) return piiInside(x-1,y) && !piiInside(x,y);
      if(d===2) return piiInside(x-1,y-1) && !piiInside(x-1,y);
      return piiInside(x,y-1) && !piiInside(x-1,y-1);
    }
    let sx=-1,sy=region.y0;
    for(let x=region.x0;x<=region.x1;x++) if(piiInside(x,sy)) { sx=x; break; }
    if(sx<0) return [];
    let x=sx,y=sy,d=0,last=-1;
    const points=[], dx=[1,0,-1,0],dy=[0,1,0,-1];
    for(let steps=0;steps<piiLimits.contourSteps;steps++) {
      if(d!==last) points.push({x,y});
      last=d; x+=dx[d]; y+=dy[d];
      let next=-1;
      for(const turn of [1,0,3,2]) {
        const direction=(d+turn)%4;
        if(piiEdge(x,y,direction)) { next=direction; break; }
      }
      if(next<0) return [];
      d=next;
      if(x===sx && y===sy && d===0) return points;
      // Reject pathological checkerboard contours before quadratic simplification.
      if(points.length>12000) return [];
    }
    return [];
  }
  function piiDetect(data,width,height,options={},seed=null) {
    if(!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 ||
      width>piiLimits.workDimension || height>piiLimits.workDimension ||
      width*height>piiLimits.workPixels || data.length!==width*height*4) throw new Error("Invalid processing dimensions.");
    const modes=options.mode==="auto" || !options.mode ? ["dark","color"] : [options.mode];
    const sensitivity=piiClamp(Number(options.sensitivity)||0,0,100);
    const gap=piiClamp(Math.round(Number(options.gap)||0),0,3);
    const epsilon=piiClamp(Number(options.epsilon)||2,0.5,10);
    const hue=Number.isFinite(options.hue) ? options.hue : null;
    const candidates=[];
    for(const mode of modes) {
      const mask=piiDilate(piiMask(data,width,height,mode,sensitivity,hue),width,height,gap);
      const {labels,regions}=piiRegions(mask,width,height,seed);
      for(const region of regions) {
        const ratio=region.count/(width*height);
        if(ratio>0.93 || !seed && (region.x1-region.x0<18 || region.y1-region.y0<18)) continue;
        const contour=piiTraceContour(labels,width,height,region);
        if(contour.length<3) continue;
        const points=piiSimplify(contour,epsilon);
        if(piiValidate(points)) continue;
        const area=piiArea(points), rawArea=piiArea(contour);
        if(Math.abs(area-rawArea)/rawArea>0.12) continue;
        // Tiny text loops and very convoluted texture are not credible auto proposals.
        let perimeter=0;
        points.forEach((p,i)=>perimeter+=piiDistance(p,points[(i+1)%points.length]));
        const roughness=perimeter/Math.sqrt(area);
        if(!seed && (roughness>18 || points.length>80 || ratio<0.01)) continue;
        const box=piiBounds(points);
        if(candidates.some(c=>Math.abs(c.area-area)/area<0.05 &&
          Math.hypot(piiBounds(c.points).cx-box.cx,piiBounds(c.points).cy-box.cy)<4)) continue;
        candidates.push({points,area,mode,score:ratio/(1+Math.max(0,roughness-5)*0.15),
          description:mode==="dark" ? "Dark-line enclosed region" : "Colored-outline enclosed region"});
      }
    }
    return candidates.sort((a,b)=>b.score-a.score).slice(0,8);
  }
  function piiMeasurements(points,reference,center={x:0,y:0}) {
    const error=piiValidate(points);
    if(error) throw new Error(error);
    if(!reference || !Number.isInteger(reference.edgeIndex) || reference.edgeIndex<0 ||
      reference.edgeIndex>=points.length || !Number.isFinite(reference.lengthFeet) || reference.lengthFeet<=0)
      throw new Error("Choose a side and enter a positive, finite length in feet.");
    if(!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Invalid yard center.");
    const scale=reference.lengthFeet/piiDistance(points[reference.edgeIndex],points[(reference.edgeIndex+1)%points.length]);
    const b=piiBounds(points), lengths=points.map((p,i)=>piiDistance(p,points[(i+1)%points.length])*scale);
    const area=piiArea(points)*scale*scale;
    const converted=points.map(p=>({x:(p.x-b.cx)*scale+center.x,y:(p.y-b.cy)*scale+center.y}));
    if(!Number.isFinite(scale) || scale<=0 || !Number.isFinite(area) || area<=0 ||
      lengths.some(n=>!Number.isFinite(n) || n<=0) || converted.some(p=>!Number.isFinite(p.x) || !Number.isFinite(p.y)))
      throw new Error("The scale is outside the usable numeric range.");
    for(let i=0;i<converted.length;i++) if(!piiDistance(converted[i],converted[(i+1)%converted.length]))
      throw new Error("The scale loses coordinate precision at this yard center.");
    return {points:converted,lengths,area,scale};
  }
  function piiSplit(points,labels,index,id) {
    const a=points[index],b=points[(index+1)%points.length];
    points.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,id});
    labels.splice(index+1,0,"");
  }
  function piiRemove(points,labels,index) {
    const prev=(index+points.length-1)%points.length;
    labels[prev]=[...new Set([labels[prev],labels[index]].filter(Boolean))].join(" / ");
    points.splice(index,1); labels.splice(index,1);
  }
  function piiImageHeader(buffer) {
    const bytes=new Uint8Array(buffer), view=new DataView(buffer), n=bytes.length;
    const piiASCII=(offset,length)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
    let width=0,height=0,type="";
    if(n>=24 && bytes[0]===137 && piiASCII(1,3)==="PNG" && bytes[4]===13 &&
      bytes[5]===10 && bytes[6]===26 && bytes[7]===10 && piiASCII(12,4)==="IHDR") {
      width=view.getUint32(16); height=view.getUint32(20); type="image/png";
    } else if(n>=4 && bytes[0]===255 && bytes[1]===216) {
      let p=2;
      while(p+3<n) {
        if(bytes[p++]!==255) throw new Error("Malformed JPEG marker.");
        while(p<n && bytes[p]===255) p++;
        const marker=bytes[p++];
        if(marker===217 || marker===218) break;
        if(marker===1 || marker>=208 && marker<=215) continue;
        if(p+2>n) break;
        const length=view.getUint16(p);
        if(length<2 || p+length>n) throw new Error("Truncated JPEG.");
        if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
          if(length<8) break;
          height=view.getUint16(p+3); width=view.getUint16(p+5); type="image/jpeg"; break;
        }
        p+=length;
      }
    } else if(n>=30 && piiASCII(0,4)==="RIFF" && piiASCII(8,4)==="WEBP") {
      const piiU24=p=>bytes[p]|bytes[p+1]<<8|bytes[p+2]<<16;
      const kind=piiASCII(12,4);
      if(kind==="VP8X") {
        if(bytes[20]&2) throw new Error("Animated WebP is not supported. Export a still image.");
        width=piiU24(24)+1; height=piiU24(27)+1;
      } else if(kind==="VP8 " && n>=30 && bytes[23]===157 && bytes[24]===1 && bytes[25]===42) {
        width=view.getUint16(26,true)&16383; height=view.getUint16(28,true)&16383;
      } else if(kind==="VP8L" && bytes[20]===47) {
        const bits=view.getUint32(21,true);
        width=(bits&16383)+1; height=((bits>>>14)&16383)+1;
      }
      type="image/webp";
    }
    if(!type || !width || !height) throw new Error("Unrecognized or damaged image. Use a still PNG, JPEG or WebP.");
    if(width>piiLimits.dimension || height>piiLimits.dimension || width*height>piiLimits.pixels)
      throw new Error("Image exceeds 8,192 px per dimension or 24 megapixels. Resize it locally first.");
    return {width,height,type};
  }
  function piiWorkSize(width,height) {
    // Reserve room for ceiling to integral canvas dimensions, then draw with ONE
    // scale. The subpixel white padding avoids anisotropic resampling of long plans.
    const scale=Math.min(1,piiLimits.workDimension/width,piiLimits.workDimension/height,
      Math.sqrt((piiLimits.workPixels-2*piiLimits.workDimension)/(width*height)));
    return {width:Math.min(piiLimits.workDimension,Math.max(1,Math.ceil(width*scale))),
      height:Math.min(piiLimits.workDimension,Math.max(1,Math.ceil(height*scale))),scale};
  }

  let piiUI=null, piiState=null, piiDraft=null, piiSequence=0, piiID=0, piiReturnFocus=null;
  let piiInert=[], piiOptions={}, piiBusy=false;
  function piiNewState() {
    return {points:[],labels:[],reference:null,source:null,pixels:null,candidates:[],mode:"edit",tracing:false,
      selectedCorner:0,selectedEdge:0,hue:null,undo:[],drag:null,traceHover:null,traceCursor:{x:0,y:0}};
  }
  function piiSay(message) { piiUI.status.textContent=message; }
  function piiRef() {
    if(!piiState.reference) return null;
    const r=piiState.reference;
    const edgeIndex=piiState.points.findIndex((p,i)=>p.id===r.a && piiState.points[(i+1)%piiState.points.length].id===r.b);
    return edgeIndex<0 ? null : {edgeIndex,lengthFeet:r.lengthFeet};
  }
  function piiHistory() {
    piiState.undo.push(piiClone({points:piiState.points,labels:piiState.labels,reference:piiState.reference,
      mode:piiState.mode,tracing:piiState.tracing}));
    if(piiState.undo.length>40) piiState.undo.shift();
  }
  function piiChanged() {
    piiState.traceHover=null;
    if(piiState.reference && !piiRef()) {
      piiState.reference=null;
      piiSay("The reference side was split or merged. Choose an unchanged known side and calibrate again.");
    }
    piiUI.reviewed.checked=false;
  }
  function piiInstall(points,labels) {
    piiStopDrag();
    piiState.points=points.map(p=>({x:p.x,y:p.y,id:++piiID}));
    piiState.labels=points.map((_,i)=>typeof labels?.[i]==="string" ? labels[i].slice(0,11000) : "");
    piiState.reference=null; piiState.mode="edit"; piiState.tracing=false; piiState.selectedCorner=0; piiState.selectedEdge=0;
    piiUI.feet.value=""; piiChanged(); piiRender();
  }
  function piiSelectOptions(select,labels,index) {
    select.replaceChildren();
    labels.forEach((label,i)=>{
      const option=document.createElement("option"); option.value=String(i); option.textContent=label; select.append(option);
    });
    select.value=String(index); select.disabled=!labels.length;
  }
  function piiSVG(tag,attrs,text) {
    const node=document.createElementNS(piiNS,tag);
    for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
    if(text!==undefined) node.textContent=text;
    return node;
  }
  function piiNumber(value) {
    return value!==0 && (Math.abs(value)<0.01 || Math.abs(value)>=1e9) ? value.toExponential(3) :
      value.toLocaleString(undefined,{maximumFractionDigits:2});
  }
  function piiTraceHit(point,pointerType) {
    const rect=piiUI.overlay.getBoundingClientRect();
    return piiTraceTarget(piiState.points,point,rect.width/piiUI.image.width,rect.height/piiUI.image.height,pointerType);
  }
  function piiClearTraceHover() {
    if(!piiState?.traceHover) return;
    piiState.traceHover=null; piiRenderTracePreview();
  }
  function piiRenderTracePreview() {
    piiUI.overlay.querySelector(".pii-trace-preview")?.remove();
    const tracing=piiState.tracing && piiState.mode==="trace" && !piiBusy;
    piiUI.traceHelp.hidden=!tracing;
    delete piiUI.overlay.dataset.piiTrace;
    if(!tracing) return;
    const points=piiState.points, hover=piiState.traceHover;
    const hit=hover ? piiTraceHit(piiPosition(hover),hover.pointerType):null;
    const closing=hit && !hit.error;
    piiUI.overlay.dataset.piiTrace=hit ? closing ? "closing":"blocked":"drawing";
    const help=hit ? closing ?
      "Click or tap Start to close the boundary. All corners, including the last, will be kept." :
      `Cannot close here: ${hit.error}` :
      "Trace is open. Add corners, then click or tap Start (corner 1) to close. Enter or Finish trace also works.";
    if(piiUI.traceHelp.textContent!==help) piiUI.traceHelp.textContent=help;
    if(!points.length) return;
    const rect=piiUI.overlay.getBoundingClientRect();
    const fx=piiUI.image.width/(rect.width || 600), fy=piiUI.image.height/(rect.height || 600);
    const group=piiSVG("g",{class:"pii-trace-preview","aria-hidden":"true"});
    const start=points[0], last=points[points.length-1];
    if(closing) {
      group.append(piiSVG("polygon",{points:points.map(p=>`${p.x},${p.y}`).join(" "),class:"pii-close-fill"}));
      group.append(piiSVG("line",{x1:last.x,y1:last.y,x2:start.x,y2:start.y,class:"pii-close-edge"}));
    }
    if(hit) {
      const p=points[hit.index];
      group.append(piiSVG("ellipse",{cx:p.x,cy:p.y,rx:hit.radius*fx,ry:hit.radius*fy,
        class:`pii-close-ring${closing ? "":" pii-close-invalid"}`}));
    }
    group.append(piiSVG("ellipse",{cx:start.x,cy:start.y,rx:10*fx,ry:10*fy,class:"pii-start-ring"}));
    group.append(piiSVG("text",{x:start.x+13*fx,y:start.y+19*fy,class:"pii-start-text","font-size":12*fy},
      closing ? "CLICK / TAP TO CLOSE":"START"));
    piiUI.overlay.append(group);
  }
  function piiRender() {
    if(!piiState || !piiUI) return;
    const points=piiState.points, n=points.length, tracing=piiState.tracing;
    const error=piiValidate(points), ref=piiRef();
    let measurement=null, scaleError="";
    if(!error && ref) try { measurement=piiMeasurements(points,ref); } catch(e) { scaleError=e.message; }
    piiState.selectedCorner=piiClamp(piiState.selectedCorner,0,Math.max(0,n-1));
    piiState.selectedEdge=piiClamp(piiState.selectedEdge,0,Math.max(0,n-1));
    const selected=piiState.selectedCorner, edge=piiState.selectedEdge;
    const focused=document.activeElement?.getAttribute("data-pii-corner");
    piiUI.overlay.replaceChildren();
    if(n) {
      piiUI.overlay.append(piiSVG(tracing ? "polyline":"polygon",{
        points:points.map(p=>`${p.x},${p.y}`).join(" "),class:"pii-shape",...(tracing?{style:"fill:none"}:{})}));
      const width=piiUI.overlay.getBoundingClientRect().width || 600;
      const factor=piiUI.image.width/width, radius=6*factor;
      for(let i=0;i<(tracing ? n-1:n);i++) {
        const a=points[i],b=points[(i+1)%n];
        const line={x1:a.x,y1:a.y,x2:b.x,y2:b.y};
        if(i===edge) piiUI.overlay.append(piiSVG("line",{...line,class:"pii-edge-active"}));
        piiUI.overlay.append(piiSVG("line",{...line,class:"pii-edge-hit","data-pii-edge":i}));
        const length=measurement ? `${piiNumber(measurement.lengths[i])} ft` : `${piiNumber(piiDistance(a,b))} px`;
        const name=piiState.labels[i] || `Side ${i+1}`;
        piiUI.overlay.append(piiSVG("text",{x:(a.x+b.x)/2,y:(a.y+b.y)/2-9*factor,
          class:"pii-edge-text","font-size":12*factor},`${name}: ${length}`));
      }
      for(let i=0;i<n;i++) {
        const p=points[i];
        piiUI.overlay.append(piiSVG("circle",{cx:p.x,cy:p.y,r:radius,
          class:`pii-corner-handle${i===selected?" pii-corner-selected":""}`,tabindex:i===selected?"0":"-1",
          role:"button","aria-label":`Corner ${i+1}, x ${piiNumber(p.x)}, y ${piiNumber(p.y)} image pixels. ${tracing ?
            i===0 ? "Start: click to close when valid; Enter finishes." : "Close at Start (corner 1); Enter finishes." :
            "Arrow keys move; Delete removes."}`,
          "data-pii-corner":i}));
      }
      if(focused!==null && focused!==undefined) piiUI.overlay.querySelector(`[data-pii-corner="${selected}"]`)?.focus({preventScroll:true});
    }
    if(["trace","sample","recover"].includes(piiState.mode)) {
      const c=piiState.traceCursor;
      piiUI.overlay.append(piiSVG("path",{d:`M ${c.x-7} ${c.y} h 14 M ${c.x} ${c.y-7} v 14`,
        stroke:"#ff8c00","stroke-width":2,"pointer-events":"none"}));
    }
    piiSelectOptions(piiUI.corner,points.map((_,i)=>`Corner ${i+1}`),selected);
    piiSelectOptions(piiUI.edge,points.map((_,i)=>`Side ${i+1}${piiState.labels[i] ? ` — ${piiState.labels[i]}`:""}`),edge);
    if(document.activeElement!==piiUI.label) piiUI.label.value=piiState.labels[edge] || "";
    if(document.activeElement!==piiUI.x) piiUI.x.value=n ? String(Math.round(points[selected].x*10)/10) : "";
    if(document.activeElement!==piiUI.y) piiUI.y.value=n ? String(Math.round(points[selected].y*10)/10) : "";
    piiUI.x.max=String(piiUI.image.width); piiUI.y.max=String(piiUI.image.height);
    for(const node of [piiUI.x,piiUI.y,piiUI.label]) node.disabled=!n;
    piiUI.add.disabled=!n || n>=piiLimits.corners || tracing;
    piiUI.remove.disabled=n<=(tracing?0:3);
    piiUI.finish.disabled=!tracing || !!error;
    piiUI.undo.disabled=!piiState.undo.length;
    piiUI.calibrate.disabled=!!error || tracing;
    piiUI.unscale.disabled=!ref;
    piiUI.clearColor.disabled=piiState.hue===null;
    piiUI.measures.replaceChildren();
    for(let i=0;i<n;i++) {
      const row=document.createElement("tr");
      const values=[`${i+1}${ref?.edgeIndex===i?" (reference)":""}`,piiState.labels[i] || "—",
        measurement ? `${piiNumber(measurement.lengths[i])} ft` : `${piiNumber(piiDistance(points[i],points[(i+1)%n]))} px — feet unknown`];
      for(const value of values) { const cell=document.createElement("td"); cell.textContent=value; row.append(cell); }
      piiUI.measures.append(row);
    }
    piiUI.reference.textContent=measurement ?
      `Reference: ${piiState.labels[ref.edgeIndex] || `Side ${ref.edgeIndex+1}`} = ${piiNumber(ref.lengthFeet)} ft; uniform scale ${piiNumber(measurement.scale)} ft/processing px.` :
      "Unscaled — feet and square feet are unknown.";
    piiUI.area.textContent=!error && !tracing ?
      measurement ? `Area: ${piiNumber(measurement.area)} sq ft (${piiNumber(measurement.area/43560)} acres).` :
        `Image area: ${piiNumber(piiArea(points))} px². Real-world area unknown.` : "Area unavailable until the polygon is valid and closed.";
    piiUI.validity.textContent=tracing ? "Trace is open. Click Start (corner 1), press Enter, or use Finish trace to close." :
      error || scaleError || (!ref ? "Valid unscaled polygon. Calibrate to import, or keep a separate unscaled draft." :
        "Valid scaled polygon. Review the image, then check the confirmation below.");
    piiUI.commit.disabled=piiBusy || tracing || !!error || !measurement || !piiUI.reviewed.checked;
    piiUI.saveDraft.disabled=piiBusy || tracing || !!error || !!ref || !piiState.source;
    piiUI.pan.setAttribute("aria-pressed",String(piiState.mode==="pan"));
    piiUI.pan.textContent=piiState.mode==="pan" ? "Resume corner editing":"Pan / scroll image";
    piiUI.overlay.style.touchAction=piiState.mode==="pan" ? "pan-x pan-y":"none";
    piiUI.overlay.style.cursor=piiState.mode==="pan" ? "grab":piiState.mode==="edit" ? "default":"crosshair";
    piiUI.overlay.setAttribute("aria-label",["trace","sample","recover"].includes(piiState.mode) ?
      `Property boundary image editor. Cursor x ${piiNumber(piiState.traceCursor.x)}, y ${piiNumber(piiState.traceCursor.y)} image pixels.` :
      "Property boundary image editor");
    piiRenderTracePreview();
  }
  function piiSettings() {
    return {mode:piiUI.detectMode.value,sensitivity:Number(piiUI.sensitivity.value),
      gap:Number(piiUI.gap.value),epsilon:Number(piiUI.simplify.value),hue:piiState.hue};
  }
  async function piiRunDetection(seed=null) {
    if(!piiState.pixels || piiBusy) return;
    if(!piiUI.simplify.checkValidity()) { piiUI.simplify.reportValidity(); return; }
    const token=++piiSequence;
    piiBusy=true; piiUI.work.disabled=true; piiRender();
    piiSay(seed ? "Looking for an enclosed region at that point…" : "Detecting enclosed regions locally…");
    await new Promise(resolve=>setTimeout(resolve,30));
    try {
      if(token!==piiSequence || !piiUI.dialog.open) return;
      const candidates=piiDetect(piiState.pixels,piiUI.image.width,piiUI.image.height,piiSettings(),seed);
      if(token!==piiSequence) return;
      piiState.candidates=candidates; piiState.mode=piiState.tracing ? "trace":"edit";
      piiSelectOptions(piiUI.candidates,candidates.map((c,i)=>`${i+1}. ${c.description} · ${c.points.length} corners`),0);
      if(candidates.length) {
        piiHistory(); piiInstall(candidates[0].points);
        piiSay(`${candidates.length} possible enclosed region${candidates.length===1?"":"s"} found. A proposal is shown, not imported. Check its entire outline, choose another candidate or edit corners.`);
      } else {
        piiSay(`No boundary found with sufficient geometric confidence${seed ? " at that point (it may lie on a line or connect to the image edge)":""}. Try line type, sensitivity, smaller gaps, a sampled outline color, or manual trace.${piiState.points.length ? " Your existing preview was retained.":""}`);
      }
    } catch(e) { piiSay(`Detection failed: ${e.message}. Try a smaller image or manual trace.`); }
    finally {
      if(token===piiSequence) { piiBusy=false; piiUI.work.disabled=false; piiRender(); }
    }
  }
  async function piiDecode(file,type) {
    const blob=file.type===type ? file : new Blob([file],{type});
    if(typeof createImageBitmap==="function") {
      try { return await createImageBitmap(blob,{imageOrientation:"from-image"}); } catch(_) { /* Older engines use Image decoding below. */ }
    }
    return new Promise((resolve,reject)=>{
      const image=new Image(), url=URL.createObjectURL(blob);
      image.onload=()=>{ URL.revokeObjectURL(url); resolve(image); };
      image.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("The browser could not decode this image.")); };
      image.src=url;
    });
  }
  function piiDraftMatches(draft,source) {
    if(!draft || draft.version!==1 || draft.units!=="image-pixels" || !draft.source ||
      piiValidate(draft.points) || !Array.isArray(draft.labels)) return false;
    return ["name","size","lastModified","width","height","processingWidth","processingHeight"]
      .every(key=>draft.source[key]===source[key]) &&
      draft.points.every(p=>p.x>=0 && p.y>=0 && p.x<=source.processingWidth && p.y<=source.processingHeight);
  }
  async function piiLoad(file) {
    if(!file) return;
    const token=++piiSequence;
    piiBusy=true; piiState=piiNewState(); piiUI.work.disabled=true; piiUI.reviewed.checked=false;
    piiUI.image.width=piiUI.image.height=1; piiUI.overlay.replaceChildren(); piiUI.feet.value="";
    piiSelectOptions(piiUI.candidates,[],0); piiUI.source.textContent="";
    piiRender(); piiSay("Checking image and decoding locally…");
    let bitmap=null, loaded=false;
    try {
      if(file.size>piiLimits.fileBytes || file.size===0) throw new Error("Choose a nonempty image no larger than 20 MiB.");
      const header=piiImageHeader(await file.arrayBuffer());
      if(token!==piiSequence) return;
      bitmap=await piiDecode(file,header.type);
      if(token!==piiSequence) return;
      const width=bitmap.naturalWidth || bitmap.width, height=bitmap.naturalHeight || bitmap.height;
      if(!width || !height || width>piiLimits.dimension || height>piiLimits.dimension || width*height>piiLimits.pixels)
        throw new Error("Decoded image exceeds the dimension or pixel limit.");
      const size=piiWorkSize(width,height), canvas=piiUI.image;
      canvas.width=size.width; canvas.height=size.height;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      if(!ctx) throw new Error("Canvas image processing is unavailable.");
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,size.width,size.height);
      ctx.drawImage(bitmap,0,0,width*size.scale,height*size.scale);
      piiState.pixels=ctx.getImageData(0,0,size.width,size.height).data;
      piiState.source={name:file.name,size:file.size,lastModified:file.lastModified,type:header.type,
        width,height,processingWidth:size.width,processingHeight:size.height,
        imageToProcessingScale:size.scale};
      piiState.traceCursor={x:size.width/2,y:size.height/2};
      piiUI.stage.style.aspectRatio=`${size.width} / ${size.height}`;
      piiUI.zoom.value="1"; piiUI.stage.style.width="100%";
      piiUI.overlay.setAttribute("viewBox",`0 0 ${size.width} ${size.height}`);
      piiUI.source.textContent=`${file.name} · ${width} × ${height} decoded px · review at ${size.width} × ${size.height} px`;
      loaded=true;
      const draft=piiOptions.draft || piiDraft;
      if(piiDraftMatches(draft,piiState.source)) {
        piiInstall(draft.points,draft.labels);
        piiSay("Unscaled draft restored over its matching image. Enter a known side length when available; nothing has been imported.");
      } else {
        piiBusy=false; piiUI.work.disabled=false;
        await piiRunDetection();
        if(token+1===piiSequence && draft) piiSay(`${piiUI.status.textContent} The saved draft belongs to a different image and was not applied.`);
      }
    } catch(e) {
      if(token===piiSequence) {
        piiState=piiNewState(); piiUI.image.width=piiUI.image.height=1;
        piiSay(`Cannot import image: ${e.message}`); piiUI.file.value="";
      }
    } finally {
      bitmap?.close?.();
      if(token===piiSequence) { piiBusy=false; piiUI.work.disabled=!loaded; piiRender(); }
    }
  }
  function piiPosition(event) {
    const rect=piiUI.overlay.getBoundingClientRect();
    return {x:piiClamp((event.clientX-rect.left)*piiUI.image.width/rect.width,0,piiUI.image.width),
      y:piiClamp((event.clientY-rect.top)*piiUI.image.height/rect.height,0,piiUI.image.height)};
  }
  function piiAddTrace(point) {
    if(piiState.points.length>=piiLimits.corners) { piiSay("Maximum 128 corners reached. Finish or remove a corner."); return; }
    piiHistory(); piiState.points.push({...point,id:++piiID}); piiState.labels.push("");
    piiState.selectedCorner=piiState.points.length-1; piiState.traceCursor={...point};
    piiChanged(); piiRender();
  }
  function piiDeleteCorner() {
    if(piiState.points.length<=(piiState.tracing?0:3)) return;
    piiStopDrag();
    piiHistory(); piiRemove(piiState.points,piiState.labels,piiState.selectedCorner);
    piiChanged(); piiRender();
  }
  function piiFinish() {
    if(!piiState.tracing) return;
    const error=piiValidate(piiState.points);
    if(error) { piiSay(error); return; }
    piiHistory(); piiState.mode="edit"; piiState.tracing=false; piiChanged(); piiRender(); piiSay("Manual trace closed. Review every side, then calibrate.");
  }
  function piiSelectEdge(index) {
    piiState.selectedEdge=index;
    piiUI.feet.value=piiRef()?.edgeIndex===index ? String(piiRef().lengthFeet) : "";
    piiRender();
  }
  function piiMode(mode,message) {
    if(!piiState.pixels || piiBusy) return;
    piiStopDrag(); piiState.traceHover=null; piiState.mode=mode; piiRender(); piiSay(message); piiUI.overlay.focus();
  }
  function piiInitialize() {
    if(piiUI) return;
    const ids=["dialog","file","close","cancel","status","source","work","image","stage","overlay","viewport",
      "detect-mode","sensitivity","sensitivity-value","gap","simplify","detect","sample","clear-color",
      "candidates","recover","trace","finish","undo","zoom","pan","corner","x","y","add","remove","edge","label",
      "feet","calibrate","unscale","reference","measures","area","validity","reviewed","save-draft","commit","trace-help"];
    piiUI={};
    for(const id of ids) {
      const node=document.getElementById(`pii-${id}`);
      if(!node) { piiUI=null; throw new Error(`Property importer markup missing: pii-${id}`); }
      piiUI[id.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=node;
    }
    if(typeof piiUI.dialog.showModal!=="function") { piiUI=null; throw new Error("Property import requires a browser with native modal dialog support."); }
    piiUI.file.addEventListener("change",()=>piiLoad(piiUI.file.files[0]));
    piiUI.close.addEventListener("click",()=>piiClose());
    piiUI.cancel.addEventListener("click",()=>piiClose());
    piiUI.dialog.addEventListener("cancel",event=>{ event.preventDefault(); if(!piiBusy || !piiUI.commit.dataset.piiPending) piiClose(); });
    piiUI.dialog.addEventListener("close",()=>{ if(!piiUI.dialog.open && piiState) piiCleanup(); });
    piiUI.detect.addEventListener("click",()=>piiRunDetection());
    piiUI.sensitivity.addEventListener("input",()=>{ piiUI.sensitivityValue.textContent=piiUI.sensitivity.value; });
    piiUI.sample.addEventListener("click",()=>piiMode("sample","Click a vivid pixel on the property outline (not the interior). Use a clearly colored line; this filters hue, not OCR."));
    piiUI.clearColor.addEventListener("click",()=>{ piiState.hue=null; piiRender(); piiSay("Color filter cleared. Detect again to apply."); });
    piiUI.recover.addEventListener("click",()=>piiMode("recover","Click inside the enclosed lot, away from text, buildings and boundary lines. An open outline reaching the image edge cannot be recovered. Keyboard: move the cursor with arrows, then Space."));
    piiUI.trace.addEventListener("click",()=>{
      piiHistory(); piiInstall([]); piiState.mode="trace"; piiState.tracing=true;
      piiMode("trace","Manual trace: click corners in order, then hover near Start (corner 1) to preview closure and click or tap to confirm. No corners are discarded. Keyboard: focus the image, move the crosshair with arrows (Shift = 10 px), Space adds a corner, Enter finishes. Undo restores the previous proposal.");
    });
    piiUI.finish.addEventListener("click",piiFinish);
    piiUI.undo.addEventListener("click",()=>{
      const state=piiState.undo.pop(); if(!state) return;
      piiStopDrag();
      Object.assign(piiState,state); piiChanged(); piiRender(); piiSay("Previous boundary edit restored.");
    });
    piiUI.candidates.addEventListener("change",()=>{
      const candidate=piiState.candidates[Number(piiUI.candidates.value)];
      if(candidate) { piiHistory(); piiInstall(candidate.points); piiSay("Candidate preview changed. Review and recalibrate before importing."); }
    });
    piiUI.zoom.addEventListener("change",()=>{ piiState.traceHover=null; piiUI.stage.style.width=`${Number(piiUI.zoom.value)*100}%`; piiRender(); });
    piiUI.viewport.addEventListener("scroll",piiClearTraceHover);
    piiUI.pan.addEventListener("click",()=>{
      const mode=piiState.mode==="pan" ? (piiState.tracing?"trace":"edit"):"pan";
      piiMode(mode,mode==="pan" ? "Pan mode: swipe or scroll the image. Corners are unchanged. Choose Resume corner editing when ready." :
        "Corner editing resumed. Drag corners, or continue placing trace corners.");
    });
    piiUI.corner.addEventListener("change",()=>{ piiState.selectedCorner=Number(piiUI.corner.value); piiRender(); });
    piiUI.edge.addEventListener("change",()=>piiSelectEdge(Number(piiUI.edge.value)));
    for(const axis of ["x","y"]) {
      piiUI[axis].addEventListener("change",()=>{
        const input=piiUI[axis], value=input.valueAsNumber, p=piiState.points[piiState.selectedCorner];
        if(!p) return;
        if(!Number.isFinite(value) || value<0 || value>Number(input.max)) {
          piiSay(`Enter a finite ${axis.toUpperCase()} coordinate between 0 and ${input.max}.`);
          input.value=String(p[axis]); return;
        }
        piiHistory(); p[axis]=value; piiChanged(); piiRender();
      });
    }
    piiUI.add.addEventListener("click",()=>{
      if(piiState.points.length>=piiLimits.corners || !piiState.points.length) return;
      piiStopDrag(); piiHistory(); piiSplit(piiState.points,piiState.labels,piiState.selectedCorner,++piiID);
      piiState.selectedCorner++; piiChanged(); piiRender();
    });
    piiUI.remove.addEventListener("click",piiDeleteCorner);
    piiUI.label.addEventListener("focus",()=>{ if(piiState.points.length) piiHistory(); });
    piiUI.label.addEventListener("input",()=>{
      if(!piiState.points.length) return;
      piiState.labels[piiState.selectedEdge]=piiUI.label.value; piiChanged(); piiRender();
    });
    piiUI.feet.addEventListener("input",()=>{
      // Editing an already-calibrated input invalidates it; never commit a stale length.
      if(piiRef()?.edgeIndex===piiState.selectedEdge) {
        piiHistory(); piiState.reference=null;
      }
      piiChanged(); piiRender();
    });
    piiUI.calibrate.addEventListener("click",()=>{
      const lengthFeet=piiUI.feet.valueAsNumber, index=piiState.selectedEdge;
      try { piiMeasurements(piiState.points,{edgeIndex:index,lengthFeet}); }
      catch(e) { piiSay(e.message); piiUI.feet.focus(); return; }
      piiHistory();
      piiState.reference={a:piiState.points[index].id,b:piiState.points[(index+1)%piiState.points.length].id,lengthFeet};
      piiChanged(); piiRender(); piiSay("Uniform scale applied to the preview. All other side lengths and area are calculated, not independently measured.");
    });
    piiUI.unscale.addEventListener("click",()=>{
      piiHistory(); piiState.reference=null; piiUI.feet.value=""; piiChanged(); piiRender();
    });
    piiUI.reviewed.addEventListener("change",piiRender);
    piiUI.saveDraft.addEventListener("click",()=>{
      if(piiUI.saveDraft.disabled) return;
      piiDraft={version:1,units:"image-pixels",points:piiState.points.map(({x,y})=>({x,y})),
        labels:piiState.labels.slice(),reference:null,source:{...piiState.source}};
      piiClose();
    });
    piiUI.commit.addEventListener("click",piiCommit);
    piiUI.overlay.addEventListener("pointerdown",event=>{
      if(piiBusy || !piiState.pixels || event.button!==0 || event.isPrimary===false || piiState.mode==="pan") return;
      const point=piiPosition(event), corner=event.target.getAttribute("data-pii-corner"), edge=event.target.getAttribute("data-pii-edge");
      if(piiState.mode==="sample" || piiState.mode==="recover") { piiActivatePoint(point); return; }
      if(piiState.mode==="trace") {
        event.preventDefault(); piiUI.overlay.focus({preventScroll:true});
        piiState.traceHover={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType};
        piiActivatePoint(point,event.pointerType); return;
      }
      if(corner!==null) {
        event.preventDefault(); piiHistory(); piiState.selectedCorner=Number(corner);
        piiState.drag={id:piiState.points[Number(corner)].id,pointer:event.pointerId};
        piiUI.overlay.setPointerCapture(event.pointerId); piiUI.overlay.focus(); piiRender();
      } else if(edge!==null) piiSelectEdge(Number(edge));
    });
    piiUI.overlay.addEventListener("pointermove",event=>{
      if(piiBusy || event.isPrimary===false) return;
      if(piiState.mode==="trace" && event.pointerType!=="touch" && event.buttons===0) {
        piiState.traceHover={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType};
        piiRenderTracePreview(); return;
      }
      if(!piiState.drag || piiState.drag.pointer!==event.pointerId) return;
      const point=piiState.points.find(p=>p.id===piiState.drag.id);
      if(!point) { piiStopDrag(); return; }
      Object.assign(point,piiPosition(event)); piiChanged(); piiRender();
    });
    function piiEndDrag(event) {
      if(piiState?.drag?.pointer===event.pointerId) {
        piiState.drag=null;
        if(piiUI.overlay.hasPointerCapture(event.pointerId)) piiUI.overlay.releasePointerCapture(event.pointerId);
      }
    }
    piiUI.overlay.addEventListener("pointerup",piiEndDrag);
    piiUI.overlay.addEventListener("pointercancel",piiEndDrag);
    piiUI.overlay.addEventListener("lostpointercapture",piiEndDrag);
    piiUI.overlay.addEventListener("pointerleave",piiClearTraceHover);
    piiUI.overlay.addEventListener("pointercancel",piiClearTraceHover);
    piiUI.overlay.addEventListener("blur",piiClearTraceHover,true);
    piiUI.overlay.addEventListener("keydown",event=>{
      const corner=event.target.getAttribute("data-pii-corner");
      if(piiBusy || piiState.mode==="pan") return;
      if(event.key==="Enter" && piiState.mode==="trace") { event.preventDefault(); piiFinish(); return; }
      if(event.key===" " && piiState.mode!=="edit") { event.preventDefault(); piiActivatePoint(piiState.traceCursor); return; }
      if((event.key==="Delete" || event.key==="Backspace") && corner!==null) {
        event.preventDefault(); piiState.selectedCorner=Number(corner); piiDeleteCorner(); return;
      }
      if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      piiState.traceHover=null;
      const step=event.shiftKey?10:1;
      let p;
      if(piiState.mode!=="edit") p=piiState.traceCursor;
      else if(corner!==null) { piiHistory(); piiState.selectedCorner=Number(corner); p=piiState.points[Number(corner)]; }
      if(!p) return;
      p.x=piiClamp(p.x+(event.key==="ArrowRight"?step:event.key==="ArrowLeft"?-step:0),0,piiUI.image.width);
      p.y=piiClamp(p.y+(event.key==="ArrowDown"?step:event.key==="ArrowUp"?-step:0),0,piiUI.image.height);
      if(piiState.mode==="edit") piiChanged();
      piiRender();
    });
    // Contain keyboard/pointer bubbling so document-level yard shortcuts do not
    // delete objects or modify history while editing names or corners.
    for(const type of ["keydown","keyup","keypress","pointerdown","pointerup","click","wheel"]) {
      piiUI.dialog.addEventListener(type,event=>{
        if(type==="keydown" && event.key==="Tab") {
          const list=[...piiUI.dialog.querySelectorAll("button,input,select,[tabindex='0']")]
            .filter(node=>!node.matches(":disabled") && node.getClientRects().length);
          const first=list[0],last=list[list.length-1];
          if(event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
          else if(!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
        }
        event.stopPropagation();
      });
    }
    if(typeof ResizeObserver==="function") new ResizeObserver(()=>{
      if(piiUI.dialog.open) { piiState.traceHover=null; piiRender(); }
    }).observe(piiUI.stage);
  }
  function piiActivatePoint(point,pointerType="mouse") {
    if(piiState.mode==="trace") {
      const hit=piiTraceHit(point,pointerType);
      if(!hit) piiAddTrace({...point});
      else if(!hit.error) piiFinish();
      else { piiRenderTracePreview(); piiSay(`Cannot close here: ${hit.error}`); }
    }
    else if(piiState.mode==="recover") piiRunDetection(point);
    else if(piiState.mode==="sample") {
      const x=piiClamp(Math.floor(point.x),0,piiUI.image.width-1),y=piiClamp(Math.floor(point.y),0,piiUI.image.height-1);
      const i=(y*piiUI.image.width+x)*4, data=piiState.pixels, r=data[i],g=data[i+1],b=data[i+2];
      if(Math.max(r,g,b)-Math.min(r,g,b)<35) { piiSay("That pixel is not strongly colored. Pick a vivid outline pixel or use dark-line mode."); return; }
      piiState.hue=piiHue(r,g,b); piiUI.detectMode.value="color"; piiState.mode=piiState.tracing?"trace":"edit"; piiRender();
      piiSay(`Outline hue selected (${Math.round(piiState.hue)}° ±25°). Detect again or find an enclosed region.`);
    }
  }
  async function piiCommit() {
    if(piiBusy || piiUI.commit.disabled) return;
    const token=piiSequence;
    try {
      const ref=piiRef(), center=piiOptions.center || {x:0,y:0};
      const measurement=piiMeasurements(piiState.points,ref,center);
      if(typeof piiGlobal.applyImportedBoundary!=="function") throw new Error("Integration hook applyImportedBoundary is not installed. Nothing was imported.");
      const payload={points:measurement.points,labels:piiState.labels.slice(),reference:{...ref},
        source:{...piiState.source,feetPerProcessingPixel:measurement.scale,center:{...center},
          method:"local-contour-or-manual",coordinateSpace:"feet-x-right-y-down",
          calibratedAt:new Date().toISOString()}};
      piiBusy=true; piiUI.commit.dataset.piiPending="true"; piiUI.work.disabled=true;
      piiUI.file.disabled=piiUI.close.disabled=piiUI.cancel.disabled=true; piiRender();
      const result=await piiGlobal.applyImportedBoundary(payload);
      if(token!==piiSequence || !piiUI.dialog.open) return;
      if(result===false) throw new Error("The app declined this boundary. Your preview has been retained.");
      piiDraft=null;
      delete piiUI.commit.dataset.piiPending; piiBusy=false; piiClose();
    } catch(e) {
      if(token!==piiSequence || !piiUI.dialog.open) return;
      piiBusy=false; delete piiUI.commit.dataset.piiPending;
      piiUI.work.disabled=false; piiUI.file.disabled=piiUI.close.disabled=piiUI.cancel.disabled=false;
      piiSay(`Import not completed: ${e.message}`); piiRender();
    }
  }
  function piiStopDrag() {
    const drag=piiState?.drag;
    if(!drag) return;
    piiState.drag=null;
    if(piiUI.overlay.hasPointerCapture(drag.pointer)) piiUI.overlay.releasePointerCapture(drag.pointer);
  }
  function piiCleanup() {
    piiStopDrag();
    ++piiSequence; piiBusy=false;
    for(const [node,wasInert] of piiInert) node.inert=wasInert;
    piiInert=[];
    if(piiUI) {
      piiUI.file.value=""; piiUI.file.disabled=piiUI.close.disabled=piiUI.cancel.disabled=false;
      delete piiUI.commit.dataset.piiPending;
      piiUI.image.width=piiUI.image.height=1; piiUI.overlay.replaceChildren();
    }
    piiState=null;
    if(piiReturnFocus?.isConnected) piiReturnFocus.focus({preventScroll:true});
    piiReturnFocus=null;
  }
  function piiClose() {
    if(piiUI?.commit.dataset.piiPending) return;
    if(piiUI?.dialog.open) { piiUI.dialog.close(); piiCleanup(); }
  }
  function piiOpen(options={}) {
    piiInitialize();
    if(piiUI.dialog.open) { piiUI.file.focus(); return; }
    // A host may call native close() and reopen before its queued close event.
    if(piiState) piiCleanup();
    ++piiSequence;
    if(options.center && (!Number.isFinite(options.center.x) || !Number.isFinite(options.center.y))) throw new Error("center must contain finite x and y feet coordinates.");
    piiOptions={center:options.center ? {...options.center}:null,draft:options.draft ? piiClone(options.draft):null};
    piiState=piiNewState(); piiReturnFocus=document.activeElement;
    piiUI.file.value=""; piiUI.work.disabled=true; piiUI.reviewed.checked=false; piiUI.feet.value="";
    piiUI.source.textContent="Maximum 20 MiB, 8,192 px per dimension and 24 megapixels. No image is uploaded or stored in app history.";
    piiRender();
    piiUI.dialog.showModal();
    // Native modal dialogs make the rest of the document noninteractive. Also
    // preserve explicit inert state for hosts/frameworks that inspect it.
    let child=piiUI.dialog;
    while(child.parentElement) {
      for(const sibling of child.parentElement.children) if(sibling!==child && sibling instanceof HTMLElement) {
        piiInert.push([sibling,sibling.inert]); sibling.inert=true;
      }
      child=child.parentElement;
      if(child===document.body) break;
    }
    piiSay(piiOptions.draft || piiDraft ?
      "An unscaled draft is available in this page session. Choose the same image to restore it. No real-world lengths have been guessed." :
      "Choose an image. Detection is a proposal only; nothing changes until you import.");
    piiUI.file.focus();
  }
  piiGlobal.PropertyImageImport=Object.freeze({
    open:piiOpen,close:piiClose,isOpen:()=>!!piiUI?.dialog.open,
    getDraft:()=>piiDraft ? piiClone(piiDraft):null,
    clearDraft:()=>{ piiDraft=null; },
    limits:piiLimits,
    algorithms:Object.freeze({area:piiArea,validate:piiValidate,simplify:piiSimplify,
      detect:piiDetect,measure:piiMeasurements,split:piiSplit,remove:piiRemove,
      header:piiImageHeader,workSize:piiWorkSize,mask:piiMask,regions:piiRegions,trace:piiTraceContour,traceTarget:piiTraceTarget})
  });
})(typeof window!=="undefined" ? window : globalThis);
