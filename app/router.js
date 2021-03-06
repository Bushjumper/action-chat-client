import Ember from 'ember';
import config from './config/environment';

const {
  Router
} = Ember;

const AppRouter = Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

AppRouter.map(function() {
  this.route('login');
  this.route('freestyle');
  this.route('streams');

  this.route('stream', {
    path: 'streams'
  }, function() {
    this.route('index', {
      path: ':stream_id'
    }, function() {
      this.route('chat');
      this.route('scoreboard');
      this.route('loading');
    });
  });

  this.route('loading');
});

export default AppRouter;