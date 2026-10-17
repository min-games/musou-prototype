"""Two-job opt-in candidate. Blender 4.5.3, run from repository root.
Reuses the approved Vanguard geometry/Run algorithm without overwriting old artifacts.
All attack hands are baked from world-space grip targets; no runtime IK is needed.
"""
import bpy, math, os, json, bmesh
from mathutils import Vector, Matrix, Quaternion
from math import sin, cos, pi
bpy.context.preferences.filepaths.save_version=0
ROOT=os.getcwd(); OUT=os.path.join(ROOT,'evidence/weapon-motion-v1');os.makedirs(OUT,exist_ok=True)
# The original procedural construction helpers are shared verbatim, but its old
# export/render stages are deliberately never executed.
source=open('scripts/blender/vanguard.py').read()
exec(source[:source.index('# 2.18 m tall')])
M['Teal']=M['Red'].copy();M['Teal'].name='Peacock teal';M['Teal'].diffuse_color=(.018,.33,.32,1);M['Teal'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.018,.33,.32,1)
M['Jade']=M['Teal'].copy();M['Jade'].name='Jade';M['Jade'].diffuse_color=(.025,.65,.47,1);M['Jade'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.025,.65,.47,1)
M['Skin'].diffuse_color=(.68,.40,.25,1);M['Skin'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.68,.40,.25,1)
# A separate female mesh; narrower torso and shoulders, smaller bracers, oval face,
# open ivory sleeves, ponytail, teal scarf and left sash. Same leg lengths allow
# exact reuse of the validated ankle trajectory and natural knee solve.
rings('Ranger fitted leather',[(1.08,.185,.125,0,0),(1.23,.20,.14,0,0),(1.48,.265,.15,0,0),(1.64,.24,.125,0,0)],'Iron','chest',16)
for z,rx,ry in [(1.12,.195,.14),(1.59,.245,.137)]:tube('armor gold seam',[(rx*cos(2*pi*j/24),ry*sin(2*pi*j/24),z) for j in range(25)],.009,'Gold','chest')
for x,z,r in [(.09,1.48,.033),(.14,1.47,.027),(.08,1.52,.022)]:tube('ivory auspicious cloud',[(x+r*cos(a),-.158,z+r*sin(a)) for a in [i*pi/8 for i in range(14)]],.009,'Ivory','chest')
rings('teal waist sash',[(1.00,.215,.145,0,0),(1.105,.205,.14,0,0)],'Teal','pelvis')
panel('jade buckle gold setting',0,-.153,1.10,.095,.09,'Gold','pelvis',0)
ell('jade buckle',(0,-.175,1.055),(.034,.016,.035),'Jade','pelvis',12,8)
for x in [-.17,0,.17]:
 panel('short articulated hip panel',x,-.153,1.00,.13,.205 if x else .225,'Ivory' if x==0 else 'Iron',('thigh.R' if x<0 else 'thigh.L') if x else 'pelvis',.025)
 panel('rear hip panel',x,.145,1.00,.13,.21,'Iron',('thigh.R' if x<0 else 'thigh.L') if x else 'pelvis',.025)
ell('left sash knot',(.23,-.10,1.04),(.05,.04,.05),'Teal','sash')
panel('teal left sash tail',.25,-.16,1.01,.085,.32,'Teal','sash',.01)
for sign,side in [(-1,'R'),(1,'L')]:
 x=sign*.155
 rings('slim trouser '+side,[(.44,.073,.078,x,0),(.58,.092,.088,x,0),(.76,.10,.095,x,0),(.92,.10,.10,x,0)],'Iron','thigh.'+side)
 rings('Ranger boot '+side,[(.095,.072,.078,x,0),(.18,.06,.068,x,0),(.44,.075,.078,x,0)],'Iron','shin.'+side)
 panel('gold edged greave',x,-.08,.43,.12,.29,'Iron','shin.'+side,-.02)
 ell('Ranger boot toe',(x,-.055,.075),(.085,.155,.075),'Iron','foot.'+side)
 tube('boot piping',[(x+.085*cos(a),-.045+.145*sin(a),.035) for a in [i*pi/12 for i in range(25)]],.009,'Gold','foot.'+side)
 ell('ivory shoulder sleeve',(sign*.365,0,1.50),(.10,.105,.17),'Ivory','arm.'+side)
 rings('ivory flared sleeve',[(1.31,.105,.11,sign*.475,0),(1.40,.08,.085,sign*.435,0),(1.54,.095,.10,sign*.37,0)],'Ivory','arm.'+side)
 ell('Ranger elbow',(sign*.48,0,1.32),(.062,.065,.07),'Skin','forearm.'+side)
 rings('slender bracer',[(1.065,.049,.055,sign*.55,0),(1.27,.064,.068,sign*.495,0)],'Iron','forearm.'+side)
 for z,cx,r in [(1.26,sign*.497,.066),(1.075,sign*.548,.05)]:tube('bracer gold hem',[(cx+r*cos(a),r*sin(a),z) for a in [i*pi/10 for i in range(21)]],.009,'Gold','forearm.'+side)
 ell('small shoulder gold',(sign*.32,0,1.64),(.12,.12,.09),'Gold','arm.'+side)
 ell('small shoulder charcoal',(sign*.32,-.008,1.653),(.11,.114,.078),'Iron','arm.'+side)
ell('female neck',(0,0,1.71),(.06,.06,.10),'Skin','head')
for z,r in [(1.68,.105),(1.72,.09),(1.76,.082)]:tube('folded teal scarf',[(r*cos(a),r*sin(a),z+.015*sin(2*a)) for a in [i*pi/12 for i in range(25)]],.034,'Teal','chest')
# Distinct oval mature face, tapered jaw; no male facial hair geometry.
rings('adult female face',[(1.785,.026,.035,0,-.035),(1.81,.051,.054,0,-.024),(1.855,.074,.068,0,-.01),(1.92,.079,.071,0,0),(1.98,.069,.06,0,.012)],'Skin','head',20)
ell('female hair cap',(0,.026,1.945),(.084,.072,.10),'Hair','head',20,12)
for s in [-1,1]:
 ell('ear',(s*.077,0,1.875),(.014,.019,.028),'Skin','head')
 ell('eye liner',(s*.034,-.069,1.91),(.025,.008,.010),'Hair','head')
 ell('eye white',(s*.034,-.077,1.910),(.018,.003,.0055),'Ivory','head')
 ell('brown iris',(s*.032,-.081,1.910),(.006,.002,.006),'Eye','head')
 tube('focused brow',[(s*.014,-.078,1.929),(s*.037,-.077,1.936),(s*.060,-.063,1.932)],.0045,'Hair','head')
 tube('framing hair lock',[(s*.07,-.02,1.99),(s*.083,-.045,1.94),(s*.080,-.038,1.84)],.017,'Hair','head')
mesh('slim nose',[(-.009,-.068,1.916),(.009,-.068,1.916),(-.012,-.086,1.864),(.012,-.086,1.864),(0,-.101,1.872)],[(0,1,4),(0,4,2),(1,3,4),(2,4,3)],'Skin','head')
tube('female lips',[(-.02,-.075,1.838),(0,-.081,1.836),(.02,-.075,1.838)],.0035,'Red','head')
for i in range(7):
 x=-.069+i*.023
 tube('swept fringe',[(x*.45,.025,2.028),(x,-.032,2.006),(x*.83-.012,-.065,1.95+abs(x)*.3)],.019,'Hair','head')
ell('ponytail base',(0,.07,2.025),(.048,.045,.05),'Hair','head')
for i in range(5):
 x=(i-2)*.017
 tube('long high ponytail',[(x,.09,2.04),(x+.018,.17,1.97),(x+.045,.20,1.82),(x+.02,.19,1.68),(x-.015,.13,1.60)],.024,'Hair','head')
tube('teal ponytail tie',[(.045*cos(a),.078+.04*sin(a),2.027) for a in [i*pi/8 for i in range(17)]],.013,'Teal','head')
for i in range(2):panel('short teal ribbon',.06+i*.035,.12,2.03,.035,.16+i*.025,'Teal','head',0)
# Build shared 17-joint armature and the original authored Idle/Run. Only these
# source sections are executed; original export paths are untouched.
exec(source[source.index('# Skeleton with explicit sockets.'):source.index('# Pack reference empties')])
rig.name='RangerRig';body.name='Ranger female armor cloth face'
# original helpers use global lists; retain this new Ranger scene in a temporary
# blend then load the existing Vanguard and process each separately below.
ranger_temp='/tmp/weapon-motion-ranger-base.blend';bpy.ops.wm.save_as_mainfile(filepath=ranger_temp)


def add_motion(hero,path):
 global rig,body,parts,M
 bpy.ops.wm.open_mainfile(filepath=path)
 scene=bpy.context.scene;scene.render.fps=30
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 body=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
 M={m.name:m for m in bpy.data.materials}
 # Normalize helper material aliases in both saved scenes.
 M['Teal']=next((m for m in bpy.data.materials if m.name=='Peacock teal'),M['Red'])
 M['Jade']=next((m for m in bpy.data.materials if m.name=='Jade'),M['Gold'])
 for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
 rig.animation_data.action=None
 # Delete the old extended fingers: closed grip hands are built in bone-local
 # coordinates, making the calibrated grip center explicit instead of guessed.
 bm=bmesh.new();bm.from_mesh(body.data);deform=bm.verts.layers.deform.active
 ids=[body.vertex_groups[n].index for n in ['hand.R','hand.L'] if n in body.vertex_groups]
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if any(v[deform].get(i,0)>.5 for i in ids)],context='VERTS');bm.to_mesh(body.data);bm.free()
 parts=[]
 for side in ['R','L']:
  rest=rig.data.bones['hand.'+side].matrix_local
  def hp(v):return rest@Vector(v)
  # Palm and four curled fingers around the local X grip axis. Tube/ell helpers
  # create in world coordinates; apply the full rest-bone matrix to local shapes.
  def handell(name,p,scale,mat):
   o=ell(name,(0,0,0),scale,mat,'hand.'+side,12,8)
   o.matrix_world=rest@Matrix.Translation(Vector(p));return o
  handell('closed fingerless palm',(0,.040,0),(.043,.037,.027),'Iron')
  for x in [-.03,-.01,.01,.03]:
   for a in [0,.9,1.8,2.7]:handell('curled grip finger',(x,.065+.022*cos(a),.022*sin(a)),(.009,.012,.011),'Skin')
  handell('grip thumb',(-.040,.060,-.012),(.014,.024,.013),'Skin')
 for o in parts:
  o.select_set(False)
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
 styles=['saber','spear','greatblade'] if hero=='vanguard' else ['shortbow','longbow','fanbow']
 # Prop bones use identity rest axes (+Y tail). This makes every exported prop
 # origin the actual grip and allows direct world matrices, with no axis guess.
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 for side in ['R','L']:
  hand=rig.data.edit_bones['hand.'+side]
  cal=Matrix(((0,0,1),(0,-1,0),(1,0,0))).to_4x4()
  b=rig.data.edit_bones.new('grip.'+side);b.parent=hand
  rest=hand.matrix.copy();rotation=rest.to_3x3()@cal.to_3x3().inverted()
  b.head=rest@Vector((0,.065,0));b.tail=b.head+rotation.col[1]*.06;b.align_roll(rotation.col[2])
 for w in styles:
  b=rig.data.edit_bones.new('socket.'+w);b.head=(0,0,0);b.tail=(0,.1,0);b.parent=rig.data.edit_bones['root']
  if w in ['spear','greatblade']:
   b=rig.data.edit_bones.new('support.'+w);b.head=(0,0,.18 if w=='spear' else -.18);b.tail=b.head+Vector((0,.1,0));b.parent=rig.data.edit_bones['socket.'+w]
  if hero=='ranger':
   for suffix in ['nock','tip.top','tip.bottom']:
    b=rig.data.edit_bones.new(w+'.'+suffix);b.head=(0,0,0);b.tail=(0,.1,0);b.parent=rig.data.edit_bones['root']
 if hero=='ranger':
  for w in styles:
   b=rig.data.edit_bones.new('stringpoint.'+w);b.head=(0,.40,0);b.tail=(0,.5,0);b.parent=rig.data.edit_bones[w+'.nock']
 bpy.ops.object.mode_set(mode='OBJECT')
 props=[]
 def joinprop(name,items):
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
  mod=o.modifiers.new('Authored socket skin','ARMATURE');mod.object=rig;props.append(o);return o
 for w in styles:
  parts=[];bn='socket.'+w
  if hero=='vanguard':
   tube(w+' leather grip',[(0,0,-.12),(0,0,0),(0,0,.08)] if w=='saber' else [(0,0,.08),(0,0,0),(0,0,-.18),(0,0,-.25 if w=='greatblade' else -.35)],.028,'Iron',bn)
   if w=='spear':
    tube('spear shaft',[(0,0,-.60),(0,0,0),(0,0,.18),(0,0,1.30)],.022,'Gold',bn)
    mesh('spear steel point',[(-.075,0,1.27),(.075,0,1.27),(0,0,1.66),(0,-.035,1.34),(0,.035,1.34)],[(0,3,2),(3,1,2),(1,4,2),(4,0,2),(0,4,1,3)],'Ivory',bn)
   else:
    width=.062 if w=='saber' else .115;length=.95 if w=='saber' else 1.20
    tube('guard',[(-width*1.7,0,.10),(width*1.7,0,.10)],.022,'Gold',bn)
    mesh(w+' blade',[(-width,0,.13),(width,0,.13),(.7*width,0,length),(0,0,length+.15),(-width*.5,0,length), (0,-.025,.13),(0,-.018,length)],[(0,5,6,4),(5,1,2,6),(4,6,3),(6,2,3),(0,4,3,2,1)],'Ivory',bn)
    ell('pommel',(0,0,-.14 if w=='saber' else -.27),(.04,.035,.04),'Gold',bn)
   joinprop('prop.'+w,parts)
  else:
   h=.52 if w=='shortbow' else .76 if w=='longbow' else .57
   lanes=[0] if w!='fanbow' else [-.10,0,.10]
   for dx in lanes:
    tube(w+' curved limb',[(dx,.10,-h),(dx,-.07,-h*.65),(dx,0,0),(dx,-.07,h*.65),(dx,.10,h)],.018,'Gold',bn)
   tube('left bow grip',[(0,0,-.085),(0,0,0),(0,0,.085)],.028,'Iron',bn)
   joinprop('prop.'+w,parts)
   # Three skinned control points: upper limb, moving string nock, lower limb.
   # String geometry weights interpolate those nodes, so the exported string
   # remains attached to the real draw hand throughout release and redraw.
   parts=[]
   for k,(a,b) in enumerate([((0,.10,-h),(0,.40,0)),((0,.40,0),(0,.10,h))]):
    o=tube('real bow string',[a,b],.003,'Ivory',w+'.nock')
    for vg in list(o.vertex_groups):o.vertex_groups.remove(vg)
    names=[w+'.tip.bottom',w+'.nock'] if k==0 else [w+'.nock',w+'.tip.top']
    gs=[o.vertex_groups.new(name=n) for n in names]
    for v in o.data.vertices:
     world=o.matrix_world@v.co; t=min(1,max(0,(world.z-a[2])/(b[2]-a[2])))
     for g,weight in zip(gs,[1-t,t]):g.add([v.index],weight,'REPLACE')
   joinprop('string.'+w,parts)
 # Analytical arm solve in WORLD space with anatomical elbow pole. Bone local
 # +Y is the limb direction; the basis is reconstructed from its actual rest axes.
 gripLocal=Vector((0,.065,0))
 def placebone(name,head,tail,pole):
  y=(tail-head).normalized();x=y.cross(pole).normalized();z=x.cross(y).normalized()
  mat=Matrix((x,y,z)).transposed().to_4x4();mat.translation=head;rig.pose.bones[name].matrix=mat
  bpy.context.view_layer.update()
 def arm(side,target,propQ,style):
  # local X runs across fingers along rod; local Y runs wrist->knuckles.
  calibration=Matrix(((0,0,1),(0,-1,0),(1,0,0))).to_quaternion()
  q=propQ@calibration
  wrist=target-q@gripLocal
  shoulder=rig.pose.bones['arm.'+side].head.copy()
  l1=rig.data.bones['arm.'+side].length;l2=rig.data.bones['forearm.'+side].length
  delta=wrist-shoulder;d=delta.length
  if d>l1+l2-.002:raise RuntimeError(('unreachable hand',hero,side,d,l1+l2,target[:]))
  y=delta.normalized()
  # Front-held melee elbows must remain in front/outside the breastplate.
  # Only the Ranger's DRAW elbow uses a rearward pole beside the cheek.
  pole=Vector((-.9,.8,-.05)) if hero=='ranger' and side=='R' else Vector((-.45 if side=='R' else .45,-1,-.35))
  pole=(pole-y*pole.dot(y)).normalized()
  a=(l1*l1-l2*l2+d*d)/(2*d);h=math.sqrt(max(0,l1*l1-a*a));elbow=shoulder+y*a+pole*h
  placebone('arm.'+side,shoulder,elbow,pole)
  placebone('forearm.'+side,elbow,wrist,pole)
  mat=q.to_matrix().to_4x4();mat.translation=wrist;rig.pose.bones['hand.'+side].matrix=mat;bpy.context.view_layer.update()
 def reset():
  for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
 def transform(p,q):
  m=q.to_matrix().to_4x4();m.translation=Vector(p);return m
 def ground(t,wide=0,weight=0):
  # Foot targets remain planted. Pelvis lowers under heavy weapons; solve knees
  # from ankle points instead of rotating shins into the floor.
  hipz=.93-weight
  rig.pose.bones['pelvis'].location.y=-weight
  bpy.context.view_layer.update()
  for side,s in [('R',-1),('L',1)]:
   hip=rig.pose.bones['thigh.'+side].head.copy();ankle=Vector((s*(.155+wide),.10 if side=='R' else -.10,.09))
   v=ankle-hip;d=v.length;l1=.49;l2=math.hypot(.35,.01);a=(l1*l1-l2*l2+d*d)/(2*d)
   pole=Vector((0,-1,0));pole=(pole-v.normalized()*pole.dot(v.normalized())).normalized();knee=hip+v.normalized()*a+pole*math.sqrt(max(0,l1*l1-a*a))
   placebone('thigh.'+side,hip,knee,Vector((1,0,0)));placebone('shin.'+side,knee,ankle,Vector((1,0,0)))
   mat=rig.data.bones['foot.'+side].matrix_local.copy();mat.translation=ankle;rig.pose.bones['foot.'+side].matrix=mat
  bpy.context.view_layer.update()
 def smooth(a,b,t):
  u=min(1,max(0,(t-a)/(b-a)));return u*u*(3-2*u)
 def pose(w,t,stage=1,ready=False,recovery=False):
  reset()
  if hero=='vanguard':
   ground(t,.025 if w=='saber' else .065 if w=='spear' else .105, (.025 if stage<3 else .025+.03*sin(pi*t)**2) if w=='saber' else (.065+.015*sin(pi*t)**2) if w=='spear' else .085+.035*sin(pi*t)**2)
   if w=='saber':
    cut=smooth(.16,.49,t);back=smooth(.70,1,t)
    a=-1.0+2*cut
    if stage==2:a=-a
    if recovery:a=(1 if stage==1 else -1)*(1-smooth(0,1,t))-smooth(0,1,t)
    base=Vector((-.23+.33*sin(-1),-.40-.08*cos(-1),1.22+.12*cos(-1)))
    baseq=Quaternion((0,1,0),-1)@Quaternion((1,0,0),.75)
    if stage==3:
     wind=smooth(0,.23,t);cut=smooth(.25,.53,t)
     raised=Vector((-.10,-.38,1.60));low=Vector((-.10,-.46,1.26))
     pos=base.lerp(raised,wind).lerp(low,cut).lerp(base,back)
     q=baseq.slerp(Quaternion((1,0,0),-.35),wind).slerp(Quaternion((1,0,0),1.75),cut).slerp(baseq,back)
    else:
     pos=Vector((-.23+.33*sin(a),-.40-.08*cos(a),1.22+.12*cos(a)));q=Quaternion((0,1,0),a)@Quaternion((1,0,0),.75)
    # A modest torso counterturn, with the lower-body foot solve unchanged.
    rig.pose.bones['chest'].rotation_quaternion=Quaternion((0,1,0),.25*a if stage!=3 else .25*(-1+2*cut)*(1-back)-.25*back)
   elif w=='spear':
    extension=smooth(.18,.48,t)*(1-smooth(.62,1,t))
    q=Quaternion((0,0,1),.65)@Quaternion((1,0,0),pi/2-.08)
    pos=Vector((-.25,-.28,1.34))+q@Vector((0,0,.16*extension))
    rig.pose.bones['chest'].rotation_quaternion=Quaternion((0,1,0),-.45)
   else:
    cut=smooth(.25,.53,t);back=smooth(.67,1,t)
    angle=-.65+2.05*cut-2.05*back
    pos=Vector((.03,-.40-.10*cut+.10*back,1.60-.35*cut+.35*back));q=Quaternion((1,0,0),angle)@Quaternion((0,1,0),-.20)
    rig.pose.bones['chest'].rotation_quaternion=Quaternion((0,1,0),.10)
   bpy.context.view_layer.update();rig.pose.bones['socket.'+w].matrix=transform(pos,q);bpy.context.view_layer.update()
   arm('R',pos,q,w)
   if w!='saber':arm('L',pos+q@Vector((0,0,.18 if w=='spear' else -.18)),q,w)
   else:
    # Free guard hand kept outside torso.
    arm('L',Vector((.34,-.27,1.25)),Quaternion((1,0,0),.2),w)
  else:
   wide=.055 if w=='shortbow' else .075 if w=='longbow' else .14
   ground(t,wide,(.035 if w=='shortbow' else .06 if w=='longbow' else .09)+ (0 if ready else (.008 if w=='shortbow' else .015 if w=='longbow' else .02)*sin(pi*t)**2))
   # Clip begins already drawn: simulation creates arrows at phase zero.
   # Immediate release is followed by follow-through then a full redraw.
   release=smooth(0,.085,t);redraw=smooth(.25 if w=='shortbow' else .38,.90 if w!='longbow' else .98,t)
   draw=.40 if ready else .40-.30*release+.30*redraw
   if w=='longbow':draw+=.045 if ready else .045*(1-release+redraw)
   recoil=0 if ready else sin(pi*min(1,t/.30))*.035 if t<.30 else 0
   pos=Vector((-.04,(-.525 if w=='longbow' else -.48)+recoil,1.74))
   q=Quaternion((0,1,0),-.22 if w=='fanbow' else -.04 if w=='longbow' else .04)
   rig.pose.bones['socket.'+w].matrix=transform(pos,q);bpy.context.view_layer.update()
   arm('L',pos,q,w)
   nock=pos+q@Vector((0,draw,.125))
   follow=0 if ready else .30*release*(1-smooth(.12,.34,t)) + (.025*sin(pi*t/.20) if t<.20 else 0)
   arm('R',nock+q@Vector((0,follow,0)),q,w)
   h=.52 if w=='shortbow' else .76 if w=='longbow' else .57
   for suffix,point,rest in [('nock',nock,(0,.40,0)),('tip.top',pos+q@Vector((0,.10,h)),(0,.10,h)),('tip.bottom',pos+q@Vector((0,.10,-h)),(0,.10,-h))]:
    rig.pose.bones[w+'.'+suffix].matrix=transform(point-q@Vector(rest),q)
  bpy.context.view_layer.update()
 # Preserve the exact approved run (and Idle for Vanguard); duplicate every
 # Euler action into quaternions before attacks are keyed, avoiding mode mixing.
 old={n:bpy.data.actions.get(n) for n in ['Idle','Run']}
 for name,act in old.items():
  rig.animation_data.action=act
  samples=[];end=60 if name=='Idle' else 24
  for f in range(1,end+2):
   for p in rig.pose.bones:p.rotation_mode='XYZ'
   scene.frame_set(f);bpy.context.view_layer.update();samples.append({p.name:(p.rotation_euler.to_quaternion().copy(),p.location.copy()) for p in rig.pose.bones})
  rig.animation_data.action=None;act.name='source.'+name
  action=bpy.data.actions.new(name);rig.animation_data.action=action
  for f,row in enumerate(samples,1):
   reset()
   for n,(q,v) in row.items():rig.pose.bones[n].rotation_quaternion=q;rig.pose.bones[n].location=v
   for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=f);p.keyframe_insert('location',frame=f)
  rig.animation_data.action=None
 clips=[]
 for w in styles:
  phases=[1,2,3] if w=='saber' else [1]
  for stage in phases:
   name=f'Saber{stage}' if w=='saber' else w.title()+('Shot' if hero=='ranger' else 'Attack')
   action=bpy.data.actions.new(name);rig.animation_data.action=action
   for f in range(1,130):
    t=(f-1)/128;pose(w,t,stage)
    for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=f,group=p.name);p.keyframe_insert('location',frame=f,group=p.name)
   clips.append(name)
  # Weapon-specific held poses prevent a bow cutting across the body at rest,
  # and keep two hands on heavy weapons before attack input.
  action=bpy.data.actions.new(w.title()+'Ready');rig.animation_data.action=action
  for f in [1,61]:
   pose(w,0,ready=True)
   for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=f,group=p.name);p.keyframe_insert('location',frame=f,group=p.name)
  clips.append(w.title()+'Ready')
 if hero=='vanguard':
  for stage in [1,2]:
   name=f'SaberRecover{stage}';action=bpy.data.actions.new(name);rig.animation_data.action=action
   for f in range(1,130):
    pose('saber',(f-1)/128,stage,recovery=True)
    for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=f,group=p.name);p.keyframe_insert('location',frame=f,group=p.name)
   clips.append(name)
 rig.animation_data.action=None
 # Quaternion components must share hemisphere at adjacent keys. In particular
 # the calibrated fist has a 180-degree rest rotation; arbitrary matrix->quat
 # signs otherwise cause a visible full spin between perfectly correct key poses.
 for name in ['Idle','Run']+clips:
  act=bpy.data.actions[name]
  curves=act.layers[0].strips[0].channelbag(act.slots[0]).fcurves
  paths={fc.data_path for fc in curves if fc.data_path.endswith('rotation_quaternion')}
  for path in paths:
   fs=sorted([fc for fc in curves if fc.data_path==path],key=lambda fc:fc.array_index)
   prev=None
   for i in range(len(fs[0].keyframe_points)):
    q=Quaternion([fc.keyframe_points[i].co.y for fc in fs])
    if prev is not None and prev.dot(q)<0:
     q.negate()
     for fc,v in zip(fs,q):fc.keyframe_points[i].co.y=v
    prev=q
  for fc in curves:
   for key in fc.keyframe_points:key.interpolation='LINEAR'
 for name in ['Idle','Run']+clips:
  act=bpy.data.actions[name];track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,act);strip.action_frame_end=act.frame_range[1]
 # For locomotion overlay runtime copies upper-body transforms from Ready;
 # props are baked at the same origins as Ready for deterministic attachment.
 rig['motionVersion']='weapon-motion-v1';rig['identity']='adult female Ranger; ponytail; teal scarf/sash; ivory sleeves; jade buckle; no beard' if hero=='ranger' else 'approved adult male Vanguard'
 rig['gripLocal']=list(gripLocal);rig['releasePhase']=0.0;rig['axes']='Blender front -Y / up +Z; socket rest identity +Y'
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
 for o in props:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,f'public/models/{hero}-weapon-motion-v1.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_anim_slide_to_zero=True,export_def_bones=False,export_texcoords=False,export_extras=True)
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 # Build neutral studio for Ranger; keep approved Vanguard studio.
 if scene.camera is None:
  scene.render.engine='CYCLES';scene.cycles.samples=12;scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='AgX'
  bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(M['Iron'])
  for p,power,size in [((2,-4,5),650,4),((-3,-1,3),450,3),((1,3,4),800,3)]:
   bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
  bpy.ops.object.camera_add(location=(0,-5,1.15));scene.camera=bpy.context.object;scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=2.8
 scene.camera.rotation_euler=(Vector((0,0,1.1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100
 rig.animation_data.action=bpy.data.actions[styles[0].title()+'Ready'];scene.frame_set(1)
 for o in props:o.hide_render=not o.name.endswith(styles[0])
 folder=f'art-source/{hero}/blender-weapon-motion-v1';os.makedirs(folder,exist_ok=True)
 # Packed guidance is editable authoring context, never presented as 3D evidence.
 if hero=='ranger':
  for path in ['art-source/ranger/ranger-front-v1-simple.png','art-source/ranger/blender-v1/ranger-turnaround-v1.png']:
   im=bpy.data.images.load(os.path.join(ROOT,path));im.pack();o=bpy.data.objects.new('REFERENCE concept '+os.path.basename(path),None);o.empty_display_type='IMAGE';o.data=im;o.empty_display_size=3;o.location=(4,1,1);scene.collection.objects.link(o)
 path=f'art-source/weapon-motion-v1/{hero}-attacks-v1.png'
 if os.path.exists(path):
  im=bpy.data.images.load(os.path.join(ROOT,path));im.pack();o=bpy.data.objects.new('REFERENCE attack concept - not animation evidence',None);o.empty_display_type='IMAGE';o.data=im;o.empty_display_size=4;o.location=(7,1,1);scene.collection.objects.link(o)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,folder,hero+'.blend'))
 print('MOTION CANDIDATE',hero,clips)

add_motion('ranger',ranger_temp)
add_motion('vanguard',os.path.join(ROOT,'art-source/vanguard/blender-v1/vanguard.blend'))
