"""Conservative actual triangle-overlap checks against chest/pelvis armor.
Hands intentionally intersect the grip: exclude hand/arm islands from torso BVH.
This supplements exact grip checks; no claim of whole-character collision freedom.
"""
import bpy,os,json
from mathutils.bvhtree import BVHTree
out='evidence/weapon-motion-v1';result={};errors=[]
for hero in ['vanguard','ranger']:
 bpy.ops.wm.open_mainfile(filepath=os.getcwd()+f'/art-source/{hero}/blender-weapon-motion-v1/{hero}.blend')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=next(o for o in bpy.data.objects if o.type=='MESH' and not o.name.startswith(('prop.','string.')) and any(m.type=='ARMATURE' for m in o.modifiers))
 groups={g.index:g.name for g in body.vertex_groups}
 torsoFaces=[p.vertices[:] for p in body.data.polygons if all(any(groups[g.group] in ['chest','pelvis'] and g.weight>.99 for g in body.data.vertices[i].groups) for i in p.vertices)]
 armFaces=[p.vertices[:] for p in body.data.polygons if all(any(groups[g.group].startswith(('forearm.','hand.')) and g.weight>.99 for g in body.data.vertices[i].groups) for i in p.vertices)]
 clips={'Saber1':'saber','Saber2':'saber','Saber3':'saber','SpearAttack':'spear','GreatbladeAttack':'greatblade'} if hero=='vanguard' else {w.title()+'Shot':w for w in ['shortbow','longbow','fanbow']}
 rows=[]
 for clip,w in clips.items():
  rig.animation_data.action=bpy.data.actions[clip]
  prop=bpy.data.objects['prop.'+w]
  for k in range(33):
   bpy.context.scene.frame_set(1+4*k);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);me=ev.to_mesh()
   verts=[body.matrix_world@v.co for v in me.vertices]
   torso=BVHTree.FromPolygons(verts,torsoFaces,all_triangles=False)
   arms=BVHTree.FromPolygons(verts,armFaces,all_triangles=False)
   pv=prop.evaluated_get(deps);pm=pv.to_mesh();weapon=BVHTree.FromPolygons([prop.matrix_world@v.co for v in pm.vertices],[p.vertices[:] for p in pm.polygons],all_triangles=False)
   hits=torso.overlap(weapon);armhits=torso.overlap(arms)
   row={'clip':clip,'phase':k/32,'torsoWeaponTrianglePairs':len(hits),'torsoForearmHandTrianglePairs':len(armhits)};rows.append(row)
   if hits or armhits:errors.append([hero,row])
   ev.to_mesh_clear();pv.to_mesh_clear()
 result[hero]=rows
result['errors']=errors;open(f'{out}/geometry-clearance.json','w').write(json.dumps(result,indent=2));print('Torso / weapon overlaps',errors);print('Arm overlap summary',{h:max(r['torsoForearmHandTrianglePairs'] for r in rows) for h,rows in result.items() if h!='errors'})
assert not errors
