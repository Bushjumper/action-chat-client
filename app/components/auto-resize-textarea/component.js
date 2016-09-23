import Ember from 'ember';

const {
  TextArea,
  run,
  observer
} = Ember;

export default TextArea.extend({
  classNames: ['c-auto-resize-textarea'],

  value: '',

  resetSize: observer('value', function() {
    this._resize();
  }),

  _resize() {
    let textArea = this.element;

    run.debounce(this, function() {
      textArea.style.cssText = 'height:auto; padding:0';
      textArea.style.cssText = `height:${textArea.scrollHeight}px`;
    }, 50);
  },

  keyPress(e) {
    if (this.get('onKeyDown')) {
      this.get('onKeyDown')(e);
    }
  },

  keyUp() {
    if (this.get('onKeyUp')) {
      this.get('onKeyUp')();
    }
  },

  focusIn() {
    if (this.get('onFocusIn')) {
      this.get('onFocusIn')();
    }
  },

  focusOut() {
    if (this.get('onFocusOut')) {
      this.get('onFocusOut')();
    }
  }

});