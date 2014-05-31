//this script is called from [[en:user:js/ajaxPreview.js]] and [[ru:MediaWiki:Gadget-preview.js]]
//after the buttons are created

ajaxPreview = new function(){



var wkPreview  = $('#wikiPreview'), frm = document.editform
if (!wkPreview.length || !frm) return
$('#wpPreviewLive, #wpDiffLive').click(run)

var cssWait, cssLang, cssPreview, cssOutdated
var isDiff, isFullPreview, btn, oldHeight, htm, scriptTip
var mm = window.ajaxPreviewMsg || {}


function run (e){

 btn = $(this)
 btn.width( btn.outerWidth() ).attr('orig', btn.val())
 btn.val('...')
 
 $('#wikiDiff, #newarticletext').hide()
 oldHeight = wkPreview.height()
 scriptTip = ''
 
 if (!cssWait) cssWait = mw.util.addCSS('#wikiPreview {opacity: 0.3; color:gray} body {cursor:wait }')
 else cssWait.disabled = false

 var url = mw.config.get('wgScriptPath') + '/api.php?format=json', data, ext
 var txt = mw.user.options.get( 'usebetatoolbar' )
	? $( '#wpTextbox1' ).data( 'wikiEditor-context' ).$textarea.textSelection( 'getContents' )
	: frm.wpTextbox1.value

 isDiff = btn.attr('id') == 'wpDiffLive'

 if (isDiff){

   mw.loader.load( 'mediawiki.action.history.diff' )

   url += '&action=query&prop=revisions'
   data = { titles: mw.config.get('wgPageName').replace(/_/g,' '),  rvdifftotext: txt}

   if (frm.wpSection.value) url += '&rvsection=' + frm.wpSection.value

   if (frm.oldid.value && frm.oldid.value != '0'){ //can compare to currently edited older version, not to the latest
     if (e.shiftKey)  {
       url += '&rvstartid=' + frm.oldid.value + '&rvendid=' + frm.oldid.value
       scriptTip = mm.diff2old
     }  
     else scriptTip = mm.difftip
   }
   
 }else{ //preview

   if (frm.wpSection.value) txt += '<br /><references />'

   if ( $.inArray(mw.config.get('wgNamespaceNumber'), [2 , 8]) !== -1 && (ext = /\.(js|css)$/.exec(mw.config.get('wgTitle'))) ){
      txt = '<syntaxhighlight lang="' + (ext[1]=='js'?'javascript':'css') + '">' + txt + '</'+'syntaxhighlight>'
      if (!cssLang) {
        cssLang = true
        mw.loader.load('//en.wikipedia.org/w/index.php?title=user:js/ajaxPreview/'+ext[1]+'.css&action=raw&ctype=text/css&nocache=1', 'text/css')
      }
   }
  
   url += '&action=parse&pst=&disablepp=&prop=text|modules'
   data = { title: mw.config.get('wgPageName'), text: txt, summary: frm.wpSummary.value}

   if (window.ajaxPreviewFull || e.shiftKey){
     isFullPreview = true
     url += '|categorieshtml|languageshtml|templates'
   }else{
     isFullPreview = false
     if (mw.config.get('wgNamespaceNumber')==0) scriptTip = mm.viewtip
   }
 
 }

 //switch to multipart to decrease sent data volume on non-latin languages
 var boundary = '--------123xyz' + Math.random(), dat2 = ''
 for (var nm in data) dat2 += '--' + boundary + '\nContent-Disposition: form-data; name="'+nm+'"\n\n' + data[nm] + '\n'

 //send
 $.ajax({
  url: url,
  type: 'post',
  data : dat2 + '--' + boundary,
  contentType: 'multipart/form-data; charset=UTF-8; boundary='+boundary,
  success: receive
 })

}//run



function receive(resp){

  cssWait.disabled = true
  btn.val(btn.attr('orig'))
  if (window.currentFocused) currentFocused.focus()
 
  htm = ''
 
  try {
    if (isDiff){
      htm = resp.query.pages[mw.config.get('wgArticleId')].revisions[0].diff['*']
      if (htm)
        htm = '<table class=diff>'
         +'<col class=diff-marker><col class=diff-content><col class=diff-marker><col class=diff-content>'
         + htm + '</table>'
      else
        htm = mm.emptydiff
    }else{
      resp = resp.parse
      htm = resp.text['*']
      if (frm.wpSection.value == 'new'){ //add summary as H2
        htm = '<h2>' + resp.parsedsummary['*'] + '</h2>' + htm
      }else{
        var $sum = $(frm).find('div.mw-summary-preview') //create summary preview if needed
        if (!$sum.length) $sum = $('<div class=mw-summary-preview />').insertAfter('#wpSummary')
        $sum.html('<span class=comment>'+resp.parsedsummary['*']+'</span>')
      }
      if (resp.modules) {
        mw.loader.load( resp.modules.concat( resp.modulescripts, resp.modulestyles, resp.modulemessages ) );
      }
    }
  }catch (err) {  var htm = 'error: ' + err } 

  htm = 
   (scriptTip ?
     '<small style="float:right; border:1px dotted gray; padding:0 1em"><span style="color:red">!</span> '
     +scriptTip+'</small>' : '')
   + '<h3 id=ajax-preview-h3>'+btn.val()+' (ajax)</h3><hr>' // font-style:italic; text-align:right
   + htm
  wkPreview.html(htm).show()

  // New content is available, fire the hook
  mw.hook( 'wikipage.content' ).fire( wkPreview );

  if (window.ajaxPreviewScrollTop) wkPreview[0].scrollIntoView()
  else $(window).scrollTop( $(window).scrollTop() + wkPreview.height() - oldHeight ) 

  if (!isDiff) finalizePreview(resp)

}



function finalizePreview(resp){

  if (!cssPreview) cssPreview =  mw.util.addCSS('span.editsection {display:none} .hiddencats {opacity:0.5}')  // demonstrate that hiddencats will not be updated
  
  if (window.collapsibleDivs){ //ruwiki
    collapsibleDivs()
  }
  
  if (window.collapsibleTables){ //ruwiki
     collapsibleTables()
  }
  
  if ( $( '.tex' ).length && mw.user.options.get('math') === '6' ) { // 6 == mathjax mode
    mw.loader.using( 'ext.math.mathjax.enabler', function () {
      $('#wikiPreview').renderTex();
    } );
  }
  if (window.ajaxPreviewExec) ajaxPreviewExec(wkPreview[0])

  
  // !!! [[mediazilla:36476]]
  if( $('body').hasClass('ltr') )
    $('#wikiPreview').addClass('mw-content-ltr')

  if (!isFullPreview){
    if (!cssOutdated) cssOutdated = mw.util.addCSS('.templatesUsed, #p-lang, #catlinks {opacity:0.5}')
    else cssOutdated.disabled = false
    //$('#p-lang, #catlinks').attr('title', 'Not updated by latest preview')
    return
  }

  //otherwise update other areas
  if (cssOutdated) cssOutdated.disabled = true

  $('#catlinks').replaceWith(resp.categorieshtml['*'])

  htm = resp.languageshtml['*']
  var plang = $('#p-lang')
  if (!plang.length)
    plang = $('#p-tb').clone(true).attr('id','p-lang').insertAfter('#p-tb')
           .find('h5').text( htm.replace(/[:<].+$/,'') ).end()
  plang.find('ul').html(
    '<li>' + htm.replace(/^[^<]*/,'').replace(/<\/a>[^<]+/g,'</a></li><li>') + '</li>'
  )

  htm = ''
  var tt = resp.templates
  for (var i=0; i<tt.length; i++)
    htm += '<li><a href="/wiki/'+encodeURIComponent(tt[i]['*'])+'"'
    + (typeof tt[i].exists == 'string' ? '' : ' class=new')
    + '>' + tt[i]['*'] + '</a></li>'
  $('#editform').find('div.templatesUsed').find('ul').html(htm)
 
 }


}
