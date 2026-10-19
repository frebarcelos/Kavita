import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planPresentation } from './organization-presentation.mjs';
const libraries=[{id:2,type:0,name:'Mangas',folders:['/libraries/mangas']},{id:3,type:2,name:'Livros',folders:['/libraries/books']}];
const row=(id,name,libraryId=2,format=4)=>({id,name,libraryId,format,nameLocked:false,sortNameLocked:false,sortName:name});
const file=(seriesId,path,libraryId=2)=>({seriesId,path,libraryId,volumeId:seriesId+100,chapterId:seriesId+200});

test('curadoria antiga não altera títulos ou coleções de bibliotecas organizadas por pastas',()=>{
 const configured=[{...libraries[0],folderBasedOrganization:true},libraries[1]];
 const result=planPresentation(configured,{series:[row(1,'Metadado do volume 1'),row(4,'Metadado do volume 2'),row(2,'Metadado errado',3)],files:[file(1,'/libraries/mangas/Pasta/Arquivo v001.pdf'),file(4,'/libraries/mangas/Pasta/Arquivo v002.pdf'),file(2,'/libraries/books/Tema/Autor - Livro.pdf',3)]});
 assert.equal(result.seriesUpdates.some(update=>update.id===1),false);
 assert.equal(result.collections.some(collection=>collection.seriesIds.includes(1)),false);
 assert.ok(result.exceptions.some(exception=>exception.seriesId===1&&exception.reason==='folder_based_library'));
 assert.ok(result.seriesUpdates.some(update=>update.id===2));
});

test('organiza volumes separados por metadados em nomes ordenáveis e uma coleção, mantendo os IDs',()=>{
 const series=[row(1,'Titulo v01 (metadados)'),row(2,'Titulo v02 (metadados)')];
 const result=planPresentation(libraries,{series,files:[file(1,'/libraries/mangas/Titulo/Titulo - v001.pdf'),file(2,'/libraries/mangas/Titulo/Titulo - v002.pdf')]});
 assert.deepEqual(result.seriesUpdates.map(x=>[x.id,x.name]),[[1,'Titulo - Volume 001'],[2,'Titulo - Volume 002']]);
 assert.deepEqual(result.collections,[{title:'Mangás - Titulo',seriesIds:[1,2]}]);
 assert.deepEqual(series.map(x=>x.name),['Titulo v01 (metadados)','Titulo v02 (metadados)']);
});

test('distingue idiomas e edições pelas pastas e sinaliza variantes já misturadas em uma série',()=>{
 const series=[row(1,'Nome A'),row(2,'Nome B'),row(3,'Nome C',2,1)];
 const result=planPresentation(libraries,{series,files:[file(1,'/libraries/mangas/Titulo/Colorido/Titulo v01.pdf'),file(2,'/libraries/mangas/Titulo/Preto e branco/Titulo v01.pdf'),file(3,'/libraries/mangas/Outra/PT-BR/Outra v01.cbz'),file(3,'/libraries/mangas/Outra/EN/Outra v02.cbz')]});
 assert.equal(result.seriesUpdates.find(x=>x.id===1).name,'Titulo - Colorido');
 assert.equal(result.seriesUpdates.find(x=>x.id===2).name,'Titulo - Preto e branco');
 assert.ok(result.exceptions.some(x=>x.seriesId===3&&x.reason==='mixed_variants'));
});

test('livros usam títulos de arquivo, distinguem formatos e preservam categorias como coleções',()=>{
 const series=[row(1,'Metadado errado',3,4),row(2,'Metadado errado',3,3)];
 const result=planPresentation(libraries,{series,files:[file(1,'/libraries/books/Tecnologia/Autor - Livro [PT-BR].pdf',3),file(2,'/libraries/books/Tecnologia/Autor - Livro [PT-BR].epub',3)]});
 assert.deepEqual(result.seriesUpdates.map(x=>x.name),['Autor - Livro [PT-BR] [PDF]','Autor - Livro [PT-BR] [EPUB]']);
 assert.deepEqual(result.collections,[{title:'Livros - Tecnologia',seriesIds:[1,2]}]);
});

test('não sobrescreve nomes manuais nem inventa título para vários livros unidos',()=>{
 const series=[{...row(1,'Manual'),nameLocked:true},row(2,'Categoria',3)];
 const result=planPresentation(libraries,{series,files:[file(1,'/libraries/mangas/Titulo/Titulo v01.pdf'),file(2,'/libraries/books/Tema/Autor - Um.pdf',3),file(2,'/libraries/books/Tema/Autor - Outro.pdf',3)]});
 assert.equal(result.seriesUpdates.length,0);
 assert.ok(result.exceptions.some(x=>x.seriesId===2&&x.reason==='multiple_books_in_series'));
});
test('apresentação verifica edições concorrentes antes de alterar qualquer nome ou coleção',async()=>{
 const {applyPresentation}=await import('./organization-presentation.mjs');const writes=[];
 const api={request:async(route,options={})=>{if(options.method==='POST'){writes.push(route);return null;}return {...row(1,'Nome manual novo'),sortName:'Nome manual novo'};}};
 const plan={seriesUpdates:[{id:1,name:'Titulo',sortName:'Titulo',before:row(1,'Original')}],collections:[]};
 await assert.rejects(applyPresentation(api,plan),/concorrente/i);assert.equal(writes.length,0);
});
