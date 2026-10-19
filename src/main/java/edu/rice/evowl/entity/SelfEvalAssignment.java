package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("SelfEvalAssignment")
public class SelfEvalAssignment {

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("net id")
  private String userId;

  @ApiModelProperty("grading status")
  private boolean status;
}
