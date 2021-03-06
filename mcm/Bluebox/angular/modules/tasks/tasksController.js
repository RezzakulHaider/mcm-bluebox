'use strict';

/**
 * TasksController
 * controller for the view of tasks
 */
tasksModule.controller('TasksController',
    ['$scope', '$rootScope', '$state', '$stateParams', '$timeout', '$filter', '$http', 'fileSystemService', 'tasksService', '$cookies', '$interval',
        function ($scope, $rootScope, $state, $stateParams, $timeout, $filter, $http, fileSystemService, tasksService, $cookies, $interval) {

            console.log("tasks!");


            $scope.myMessages = [];
            $scope.validTasks = {"no": "...not loaded..."};
            $scope.availableContainers = undefined;

            $scope.newTaskDefinition = {
                "type": "",
                "container": "",
                "tenant": $cookies.get('MCM-TENANT'),
                "token": $cookies.get('XSRF-TOKEN')
            };
            $scope.credentials = {
                "tenant": $cookies.get('MCM-TENANT'),
                "token": $cookies.get('XSRF-TOKEN')
            };

            /**
             *
             * Get the list of valid tasks
             *
             * */
            tasksService.getValidTasks()
                .then(function (response) {
                        $scope.validTasks = response.data;
                        if (!response.data) {
                            $rootScope.$broadcast('FlashMessage', {
                                "type": "danger",
                                "text": "unable to retrieve task list..."
                            });
                        }
                    },
                    function errorCallback(response) {
                        console.log(JSON.stringify(response));
                        $rootScope.$broadcast('FlashMessage', {
                            "type": "danger",
                            "text": "Error: "
                            + response.data
                        });
                    });


            /**
             *
             * Get the list of container from swift
             *
             * */

            fileSystemService.getContainers("", "", 10000)
                .then(function (response) {
                    $scope.availableContainers = response.containers;
                    //console.log($scope.availableContainers);
                })
                .catch(function (response) {
                    if (401 == response.status) {
                        $state.go('loginState', {noAuth: true});
                        return;
                    }
                    $rootScope.$broadcast('FlashMessage', {
                        "type": "warning",
                        "text": response.data
                    });
                });



            /**
             *
             * send a new message
             *
             * */

            $scope.sendMessage = function() {
                tasksService.postMessage($scope.newTaskDefinition)
                .then(function (response) {
                    $rootScope.$broadcast('FlashMessage', {
                        "type": "success",
                        "text": "message sent"
                    });
                    //console.log($scope.availableContainers);
                })
                .catch(function (response) {
                    $rootScope.$broadcast('FlashMessage', {
                        "type": "warning",
                        "text": response.data
                    });
                })
            };

            /**
             *
             * receive the messages
             *
             * */

            $scope.receive_from_beginning = function() {
                tasksService.retrieveMessages($scope.credentials, true)
                .then(function (response) {
                    $scope.myMessages = $scope.myMessages.concat(response.data);
                })
                .catch(function (response) {
                    $rootScope.$broadcast('FlashMessage', {
                        "type": "warning",
                        "text": response.data
                    });
                })
            };

            var receive = function() {
                tasksService.retrieveMessages($scope.credentials, false)
                .then(function (response) {
                    $scope.myMessages = $scope.myMessages.concat(response.data);
                    //console.log(response.data);
                    $interval(function () {
                        receive();
                    }, 2000, 1);
                })
                .catch(function (response) {
                    $rootScope.$broadcast('FlashMessage', {
                        "type": "warning",
                        "text": response.data
                    });
                })
            };
            receive();


            /**
             *
             * clear the existing messages
             *
             * */
            $scope.clear_all_messages = function() {
              $scope.myMessages = [];
            };


        }]);
