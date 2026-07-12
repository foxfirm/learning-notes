document.addEventListener('DOMContentLoaded', function () {
  let slider = document.querySelector('.slider');
  let thumb = document.querySelector('.thumb');
  // 初始化

  let percent = ((thumb.getBoundingClientRect().left - slider.getBoundingClientRect().left) / (slider.offsetWidth - thumb.offsetWidth)) * 100;
  slider.style.background = `linear-gradient(to right, #2be805 0%, #2be805 ${percent}%, #ddd ${percent}%, #ddd 100%)`;


  slider.onpointerdown = function (event) {
    console.log('pointer down event:', event);
    alert('pointer down event:' + event);
    event.preventDefault();
    let newLeft = event.clientX - thumb.offsetWidth / 2 - slider.getBoundingClientRect().left;
    if (newLeft < 0) {
      newLeft = 0;
    }
    let rightEdge = slider.offsetWidth - thumb.offsetWidth;
    if (newLeft > rightEdge) {
      newLeft = rightEdge;
    }
    thumb.style.left = newLeft + 'px';

    let percent = (newLeft / rightEdge) * 100;
    slider.style.background = `linear-gradient(to right, #2be805 0%, #2be805 ${percent}%, #ddd ${percent}%, #ddd 100%)`;
  };

  thumb.ondragstart = function (event) {
    return false;
  };
  thumb.onpointerdown = function (event) {
    event.preventDefault();
    let shiftX = event.clientX - thumb.getBoundingClientRect().left;

    document.addEventListener('pointermove', onMouseMove);
    document.addEventListener('pointerup', onMouseUp);

    function onMouseMove(event) {
      let newLeft = event.clientX - shiftX - slider.getBoundingClientRect().left;
      let rightEdge = slider.offsetWidth - thumb.offsetWidth;
      if (newLeft < 0) {
        newLeft = 0;
      }
      if (newLeft > rightEdge) {
        newLeft = rightEdge;
      }

      thumb.style.left = newLeft + 'px';

      let percent = (newLeft / rightEdge) * 100;
      slider.style.background = `linear-gradient(to right, #2be805 0%, #2be805 ${percent}%, #ddd ${percent}%, #ddd 100%)`;
    }

    function onMouseUp(event) {
      document.removeEventListener('pointermove', onMouseMove);
      document.removeEventListener('pointerup', onMouseUp);
    }
  };
});


$(function () {
  console.log('jquery 3.6.0 loaded');
  console.log('$(this): ', $(this)['0'] === $(this)[0]); 
  console.log('this: ', this); 

});
