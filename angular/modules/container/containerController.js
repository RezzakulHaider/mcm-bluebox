'use strict';

/**
 * ContainerController
 * controller for the view of a single container
 */
containerModule.controller('ContainerController',
    ['$scope', '$rootScope', '$stateParams', '$timeout', '$filter', 'containerService', 'fileSystemService', 'objectClassService', 'deleteConfirmationModal',
        function($scope, $rootScope, $stateParams, $timeout, $filter, containerService, fileSystemService, objectClassService, deleteConfirmationModal) {

            /**
             * contains the relevant information about the current container
             * @type {{name: string, metadata: {objectClass: string, objectCount: number}, metadataFields: Array, objects: Array}}
             */
            $scope.container = {
                name:           $stateParams.containerName,
                metadata:       {
                    objectClass:    "",
                    objectCount:    0
                },
                metadataFields: [],
                objects:        []
            };

            /**
             * the form model for the container             *
             * @type {{name: string, objectClass: string}}
             */
            $scope.containerModel = {
                name:           $stateParams.containerName,
                objectClass:    ""
            };

            $scope.fileModel = {
                file:          null,
                retentionDate: null,
                metadata:      {}
            };

            /**
             * datePicker configuration
             * @type {{minDate: Date}}
             */
            $scope.datePicker = {

                // past dates may not be entered
                minDate: new Date()
            };

            /**
             * returns true, if there are no more objects to retrieve from the backend
             * used to prevent further requests
             * @type {function}
             */
            $scope.isEndOfListReached = containerService.isEndOfListReached;

            /**
             * uploaded portion of the file in percent
             * @type {{loaded: number, total: number, percentage: number}}
             */
            $scope.uploadProgress = {
                loaded:     0,
                total:      0,
                percentage: 0
            };

            /**
             * GET new objects from the container service
             *
             * @param {boolean} reload if true, the list will be reloaded from the beginning
             */
            $scope.getObjects = function(reload) {
                $scope.isGetObjectsRequestPending = true;
                containerService
                    .getObjects($scope.container, reload, $scope.prefix)
                    .then(function (response) {

                        // if the object class has changed
                        if (response.metadata.objectClass !== $scope.container.metadata.objectClass) {

                            // update the form model if it has not been changed by the user
                            if ($scope.isContainerModelInSync()) {
                                $scope.containerModel.objectClass = response.metadata.objectClass;
                            }

                            getMetadataFields(response.metadata.objectClass);
                        }

                        $scope.container.objects = reload ? response.objects : $scope.container.objects.concat(response.objects);
                        $scope.container.metadata = response.metadata;
                        $scope.isGetObjectsRequestPending = false;
                    })
                    .catch(function (response) {
                        $rootScope.$broadcast('FlashMessage', {
                            "type":     "danger",
                            "text":     response.data,
                            "timeout":  "never"
                        });
                        $scope.isGetObjectsRequestPending = false;
                    });
            };

            /**
             * updates the metadata fields for the given object class
             *
             * @param {string} objectClassName the name of the object class
             */
            var getMetadataFields = function(objectClassName) {
                if (!objectClassName) {
                    // if the object class has been unset, reset the metadata fields
                    $scope.container.metadataFields = [];
                    $scope.fileModel.metadata = {};
                } else {
                    // update the metadata fields
                    $scope.isGetObjectClassRequestPending = true;
                    objectClassService
                        .getObjectClass(objectClassName)
                        .then(function(objectClass) {
                            $scope.isObjectClassOutdated = false;
                            var metadataFields = $filter('jsonSchema')(objectClass.schema, true).metadataFields;
                            updateMetadataInputFields($scope.container.metadataFields, metadataFields);
                            $scope.container.metadataFields = metadataFields;
                            $scope.isGetObjectClassRequestPending = false;
                        })
                        .catch(function (response) {
                            if (response.status === 404) {
                                $scope.isObjectClassOutdated = true;
                            } else {
                                $rootScope.$broadcast('FlashMessage', {
                                    "type": "danger",
                                    "text": response.data,
                                    "timeout": "never"
                                });
                            }
                            $scope.isGetObjectClassRequestPending = false;
                        });
                }
            };

            /**
             * checks if there is any metadata field that is required
             *
             * @returns {boolean} true if there is at least one metadata field that is required, else false
             */
            $scope.isAnyMetadataFieldRequired = function() {
                return Boolean(_.findWhere($scope.container.metadataFields, {required: true}));
            };

            /**
             * compares the new metadata fields with the old ones and updates the fileModel if necessary
             *
             * @param {Array} oldMetadataFields the old metadata fields
             * @param {Array} newMetadataFields the new metadata fields
             */
            var updateMetadataInputFields = function(oldMetadataFields, newMetadataFields) {
                // check old metadata fields for stale ones to delete
                for (var i in oldMetadataFields) {
                    var oldMetadataField = oldMetadataFields[i];
                    var newMetadataField = _.findWhere(newMetadataFields, {name: oldMetadataField.name});
                    if (!newMetadataField) {
                        // if the field is no longer there, delete the input model
                        delete $scope.fileModel.metadata[oldMetadataField.name];
                    }
                }

                // update the input model for relevant new metadata fields
                for (i in newMetadataFields) {
                    newMetadataField = newMetadataFields[i];
                    oldMetadataField = _.findWhere(oldMetadataFields, {name: newMetadataField.name});

                    // if the field is new OR
                    // if the field types are different OR
                    // TODO: check for type compatibility instead of difference
                    // if the default value has changed and the user has not interacted with it
                    if (!oldMetadataField
                        || oldMetadataField.type.inputType !== newMetadataField.type.inputType
                        || (oldMetadataField.default !== newMetadataField.default && $scope.uploadForm[oldMetadataField.name].$pristine)
                    ) {
                        // (re-)set the input model to the default value
                        $scope.fileModel.metadata[newMetadataField.name] = newMetadataField.default;
                    }
                }
            };

            /**
             * PUT a container update to the file system service
             */
            $scope.updateContainer = function() {
                fileSystemService
                    .updateContainer({
                        name:           $scope.container.name,
                        objectClass:    $scope.containerModel.objectClass
                    })
                    .then(function() {
                        $rootScope.$broadcast('FlashMessage', {
                            "type": "success",
                            "text": "Container updated."
                        });
                        $scope.container.metadata.objectClass = $scope.containerModel.objectClass;
                        $scope.showContainerForm = false;
                        getMetadataFields($scope.containerModel.objectClass);
                    })
                    .catch(function (response) {
                        $rootScope.$broadcast('FlashMessage', {
                            "type":     "danger",
                            "text":     response.data,
                            "timeout":  "never"
                        });
                    });
            };

            /**
             * checks if the container form model is in sync with the actual values
             *
             * @returns {boolean} true, if the form model is identical to the actual values, else false
             */
            $scope.isContainerModelInSync = function() {
                return $scope.containerModel.objectClass === $scope.container.metadata.objectClass;
            };

            /**
             * resets the container form
             */
            $scope.resetContainerForm = function() {
                $scope.showContainerForm = false;
                $scope.containerModel.objectClass = $scope.container.metadata.objectClass;
            };

            /**
             * DELETE an object from the container
             *
             * @param {object} object the object to delete
             */
            $scope.deleteObject = function(object) {
                deleteConfirmationModal
                    .open(object.name, "object")
                    .result
                    .then(function() {
                        return containerService
                            .deleteObject($scope.container, object)
                            .then(function() {
                                $rootScope.$broadcast('FlashMessage', {
                                    "type": "success",
                                    "text": "Object \"" + object.name + "\" deleted."
                                });
                                // update objectCount and remove object from list
                                $scope.container.metadata.objectCount--;
                                $scope.container.objects = _.reject($scope.container.objects, object);
                            })
                            .catch(function (response) {
                                $rootScope.$broadcast('FlashMessage', {
                                    "type":     "danger",
                                    "text":     response.data,
                                    "timeout":  "never"
                                });
                            });
                    });
            };

            /**
             * upload the file of the uploadForm
             */
            $scope.uploadObject = function() {
                $scope.uploadProgress.percentage = 0;
                containerService
                    .uploadObject($scope.fileModel.file, $scope.container.name, $scope.fileModel.metadata, $scope.fileModel.retentionDate)
                    .then(
                        function() {
                            $rootScope.$broadcast('FlashMessage', {
                                "type": "success",
                                "text": "File \"" + $scope.fileModel.file.name + "\" uploaded."
                            });
                            resetProgressBar();

                            // reload objects
                            $scope.getObjects(true);
                        },
                        function(response) {
                            $rootScope.$broadcast('FlashMessage', {
                                "type":     "danger",
                                "text":     response.data,
                                "timeout":  "never"
                            });
                            resetProgressBar();
                        },
                        function(event) {
                            // update upload progress
                            $scope.uploadProgress.loaded = parseInt(event.loaded);
                            $scope.uploadProgress.total = parseInt(event.total);
                            $scope.uploadProgress.percentage = parseInt(100.0 * event.loaded / event.total);
                        }
                    );
            };

            /**
             * resets the upload progress bar after 0.5s delay
             */
            var resetProgressBar = function() {
                $timeout(function() {
                    $scope.uploadProgress.percentage = 0;
                }, 500);
            };

            /**
             * toggles the details section for a given object
             *
             * @param {object} object the object to toggle the details for
             */
            $scope.toggleDetails = function(object) {
                // toggle details
                object.showDetails = !object.showDetails;

                // retrieve the details if they shall be shown
                if (object.showDetails) {
                    containerService
                        .getDetails($scope.container, object)
                        .then(function (details) {
                            object.details = details;
                        })
                        .catch(function (response) {
                            $rootScope.$broadcast('FlashMessage', {
                                "type":     "danger",
                                "text":     response.data,
                                "timeout":  "never"
                            });
                        });
                }
            };

            // initial retrieval
            $scope.getObjects(true);

            // update the metadata fields if the current class was modified
            $scope.$on('objectClassModified', function(event, objectClass) {
                // if it is the current object class of the container, update the metadata fields
                if (objectClass.name === $scope.container.metadata.objectClass) {
                    updateMetadataInputFields($scope.container.metadataFields, objectClass.metadataFields);
                    $scope.container.metadataFields = objectClass.metadataFields;
                }
            });

            // reset metadata fields id a class has been deleted
            $scope.$on('objectClassDeleted', function(event, objectClassName) {
                // reset the metadata fields
                $scope.container.metadataFields = [];
                $scope.fileModel.metadata = {};
            });
        }]);