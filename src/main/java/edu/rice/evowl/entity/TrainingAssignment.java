package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("Training Assignment")
public class TrainingAssignment {

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("assignment_id")
  private Long assignment_id;

  @ApiModelProperty("net id")
  private String userId;

  @ApiModelProperty("Status")
  private boolean status;
}
