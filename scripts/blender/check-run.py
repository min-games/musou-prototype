"""Validate baked WORLD positions and evaluated mesh; render real 24-frame stride.
Run after vanguard.py with Blender --background --python scripts/blender/check-run.py.
"""
import bpy, os, json, math
from mathutils import Vector
ROOT=os.getcwd(); OUT=os.path.join(ROOT,'evidence/blender-run-v2')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art-source/vanguard/blender-v1/vanguard.blend'))
scene=bpy.context.scene; rig=bpy.data.objects['VanguardRig'];body=bpy.data.objects['Vanguard armor cloth face']
rig.animation_data.action=bpy.data.actions['Run']
rows=[]; errors=[]
groups={n:[v.index for v in body.data.vertices if any(g.group==body.vertex_groups[n].index and g.weight>.99 for g in v.groups)] for n in ['thigh.R','thigh.L','foot.R','foot.L']}
for frame in [1+i/4 for i in range(97)]:
 scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
 ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
 row={'frame':frame,'legs':{}}
 for side in ['R','L']:
  hip=rig.matrix_world@rig.pose.bones['thigh.'+side].head
  knee=rig.matrix_world@rig.pose.bones['shin.'+side].head
  ankle=rig.matrix_world@rig.pose.bones['foot.'+side].head
  # Sagittal signed cross product: a forward knee gives positive value.
  bend=(knee.y-hip.y)*(ankle.z-knee.z)-(knee.z-hip.z)*(ankle.y-knee.y)
  foot_min=min((body.matrix_world@me.vertices[i].co).z for i in groups['foot.'+side])
  inds=groups['thigh.'+side]
  center=sum((body.matrix_world@me.vertices[i].co for i in inds),Vector())/len(inds)
  # Skinning must really move the trouser vertices by the thigh matrix.
  transform=rig.matrix_world@rig.pose.bones['thigh.'+side].matrix@rig.data.bones['thigh.'+side].matrix_local.inverted()@rig.matrix_world.inverted()
  skin_error=max(((body.matrix_world@me.vertices[i].co)-(transform@body.matrix_world@body.data.vertices[i].co)).length for i in inds)
  row['legs'][side]={'hip':list(hip),'knee':list(knee),'ankle':list(ankle),'bend':bend,'soleMinZ':foot_min,'thighMeshCenter':list(center),'skinError':skin_error}
  if bend<-.00001: errors.append(['knee reversal',frame,side,bend])
  if foot_min<-.003: errors.append(['ground penetration',frame,side,foot_min])
  if skin_error>.0001:errors.append(['skin mismatch',frame,side,skin_error])
 rows.append(row);ev.to_mesh_clear()
metrics={}
for side in ['R','L']:
 legs=[r['legs'][side] for r in rows]
 metrics[side]={key:max(l[joint][axis] for l in legs)-min(l[joint][axis] for l in legs) for key,joint,axis in [('hipForwardExcursion','hip',1),('kneeForwardExcursion','knee',1),('ankleForwardExcursion','ankle',1),('kneeLift','knee',2),('meshLift','thighMeshCenter',2)]}
 metrics[side]['hipVerticalExcursion']=max(l['hip'][2] for l in legs)-min(l['hip'][2] for l in legs)
 if metrics[side]['hipForwardExcursion']>.001 or not .045<metrics[side]['hipVerticalExcursion']<.055: errors.append(['in-place pelvis drift/bounce',side])
 metrics[side]['minimumSole']=min(l['soleMinZ'] for l in legs)
 metrics[side]['loopJointError']=max((Vector(rows[0]['legs'][side][j])-Vector(rows[-1]['legs'][side][j])).length for j in ['hip','knee','ankle','thighMeshCenter'])
 for key,minimum in [('kneeForwardExcursion',.4),('ankleForwardExcursion',.55),('kneeLift',.22),('meshLift',.12)]:
  if metrics[side][key]<minimum:errors.append(['insufficient '+key,side,metrics[side][key]])
 if metrics[side]['loopJointError']>.0001:errors.append(['loop seam',side])
# Check velocity either side of wrap, rather than only identical endpoints.
for side in ['R','L']:
 for j in ['knee','ankle']:
  before=(Vector(rows[-1]['legs'][side][j])-Vector(rows[-2]['legs'][side][j]))
  after=(Vector(rows[1]['legs'][side][j])-Vector(rows[0]['legs'][side][j]))
  if (before-after).length>.025:errors.append(['wrap velocity discontinuity',side,j,(before-after).length])
open(os.path.join(OUT,'world-space-checks.json'),'w').write(json.dumps({'coordinateSystem':'Blender: front -Y, up +Z; positions meters','metrics':metrics,'errors':errors,'samples':rows},indent=2))
print('RUN METRICS',json.dumps(metrics),'ERRORS',errors)
if errors: raise RuntimeError(errors[:10])
if os.environ.get('VANGUARD_CHECK_ONLY'): raise SystemExit(0)
# 24 uniformly spaced rendered frames (endpoint excluded); full stride = .8s.
scene.render.resolution_x=480;scene.render.resolution_y=600;scene.cycles.samples=12
scene.cycles.use_denoising=True
cam=scene.camera
def aim():cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler()
for view,pos in [('right',(-5,0,1.1)),('front',(0,-5,1.1))]:
 cam.location=pos;aim()
 for f in range(1,25) if view=='right' else [1,5,9,13,17,21]:
  scene.frame_set(f);scene.render.filepath=os.path.join(OUT,f'{view}-{f:02}.png');bpy.ops.render.render(write_still=True)
