"""Round-trip GLBs and measure exported hand/socket positions and Run lower-body.
Checks skin evaluation in Blender as well as world markers, independent of metadata.
"""
import bpy,os,json,math
from mathutils import Vector
out='evidence/weapon-motion-v1';report={};errors=[]
for hero in ['ranger','vanguard']:
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=30
 bpy.ops.import_scene.gltf(filepath=os.getcwd()+f'/public/models/{hero}-weapon-motion-v1.glb')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 clips=['ShortbowShot','LongbowShot','FanbowShot'] if hero=='ranger' else ['Saber1','Saber2','Saber3','SpearAttack','GreatbladeAttack']
 body=next(o for o in bpy.data.objects if o.type=='MESH' and not o.name.startswith(('prop.','string.')) and any(m.type=='ARMATURE' for m in o.modifiers))
 thigh={s:[v.index for v in body.data.vertices if any(body.vertex_groups[g.group].name=='thigh.'+s and g.weight>.99 for g in v.groups)] for s in ['R','L']}
 feet=[v.index for v in body.data.vertices if any(body.vertex_groups[g.group].name.startswith('foot.') and g.weight>.99 for g in v.groups)]
 data={}
 for clip in ['Run']+clips:
  rig.animation_data.action=next(a for a in bpy.data.actions if a.name==clip)
  end=24 if clip=='Run' else 128;rows=[]
  for f in range(97):
   frame=end*f/96;scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
   row={'phase':f/96,'knees':{s:list(rig.pose.bones['shin.'+s].head) for s in ['R','L']},'ankles':{s:list(rig.pose.bones['foot.'+s].head) for s in ['R','L']}}
   if clip=='Run':
    ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
    row['skinThighCenters']={s:list(sum((body.matrix_world@me.vertices[i].co for i in inds),Vector())/len(inds)) for s,inds in thigh.items()}
    row['soleMin']=min((body.matrix_world@me.vertices[i].co).z for i in feet)
    ev.to_mesh_clear()
    if row['soleMin']<-.005:errors.append([hero,'skin sole penetration',f,row['soleMin']])
   if clip!='Run':
    w='saber' if clip.startswith('Saber') else clip.replace('Attack','').replace('Shot','').lower();side='R' if hero=='vanguard' else 'L'
    row['gripError']=(rig.pose.bones['grip.'+side].head-rig.pose.bones['socket.'+w].head).length
    row['orientationError']=min((rig.pose.bones['grip.'+side].matrix.to_quaternion().rotation_difference(rig.pose.bones['socket.'+w].matrix.to_quaternion())).angle,math.pi*2-(rig.pose.bones['grip.'+side].matrix.to_quaternion().rotation_difference(rig.pose.bones['socket.'+w].matrix.to_quaternion())).angle)
    if row['gripError']>.002 or row['orientationError']>.01:errors.append([hero,clip,f,row])
   rows.append(row)
  data[clip]={'samples':rows}
  if clip=='Run':
   for s in ['R','L']:
    ranges={f'{j}{axis}':max(r[j][s][axis] for r in rows)-min(r[j][s][axis] for r in rows) for j in ['knees','ankles'] for axis in [1,2]}
    # Blender import returns Blender coordinates; forward is -Y and up Z.
    ranges['skinThighLift']=max(r['skinThighCenters'][s][2] for r in rows)-min(r['skinThighCenters'][s][2] for r in rows)
    if ranges['skinThighLift']<.1:errors.append([hero,'insufficient actual skinned thigh lift',s,ranges])
    data[clip][s]=ranges
    if ranges['knees1']<.4 or ranges['knees2']<.22 or ranges['ankles1']<.55:errors.append([hero,'run insufficient',s,ranges])
 report[hero]=data
report['errors']=errors;open(f'{out}/exported-world-checks.json','w').write(json.dumps(report,indent=2));print('Exported world checks errors:',errors[:3]);assert not errors
