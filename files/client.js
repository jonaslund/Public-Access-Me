/*
Public Access Me Client
Jonas Lund, 2012
 */

jQuery(function($) {
  $("#wrap").css("visibility", "hidden");

  if($(window).height() > $("#wrap").height()) {
    $("#wrap").css({marginTop: ($(window).height() - $("#wrap").height())/2});
  }

  $(window).resize(function() {
    if($(window).height() > $("#wrap").height()) {
      $("#wrap").css({marginTop: ($(window).height() - $("#wrap").height())/2});
    }
  
  });

  var framesContainer = $('#frames');
  var sockethost = 'public-access.me:443';
  var socket = io.connect(sockethost);

  socket.on('connect', function () {
    $(window).scrollTop(72);

    $("#wrap").css("visibility", "visible");
    $("#connecting").remove();

    socket.on('screenshot', function (data) {
      if(data.src) {

        $("#cururl").text(data.url.substr(data.url.indexOf('://')+3));
        $("#title").text(data.title);
        $("#favicon").attr("src", data.favicon);

        var insertedIframe = $("<iframe />", {
          hidden: true,
          target: "_self",
          src: data.src,
          frameborder: 0,
          scrolling: 'no'
        }).prependTo($(framesContainer));
      

        $(insertedIframe).load(function() {
          $(framesContainer).removeClass("noiframe").addClass("nopics");
          $(framesContainer).find("img").remove();

          $(this).show();
          $(this).next("iframe").remove();
        });

      }
    });

    socket.on('pictua', function (data) {
      if(data.src) {

        $("#cururl").text(data.url.substr(data.url.indexOf('://')+3));
        $("#title").text(data.title);
        $("#favicon").attr("src", data.favicon);

        var insertedIframe = $("<img />", {
          "class": 'hidden',
          src: data.src
        }).prependTo($(framesContainer));
      
        $(insertedIframe).load(function() {
          
          $(framesContainer).removeClass("nopics").addClass("noiframe");
          $(framesContainer).find("iframe").remove();

          $(this).show();
          $(this).siblings("img").remove();
        });
      }
    });

    socket.on('screenSize', function(data) {
      var height = data.height,
          width = data.width;

      if(width > 825) {
        $("#outer").css({width: width});
        $("#frames, #frames iframe").css({height: height, width: width});
      
        if($(window).height() > $("#wrap").height()) {
          $("#wrap").css({marginTop: ($(window).height() - $("#wrap").height())/2});
        }
      }

    });
  });

  function noError(){return true;}
  window.onerror = noError;
  
});